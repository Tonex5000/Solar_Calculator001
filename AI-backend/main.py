"""
HTTP wrapper for the Voltra product-DB MCP tools (Path B fix for Render).

Render deploys AI-backend as an ASGI web service (`uvicorn main:app`), but the
backend's source of truth is the FastMCP server in `server.py` — the same
read-only tools the LangChain agent launches over stdio. This module re-exposes
those tools over HTTP without duplicating any tool logic: it imports `server`
and invokes each tool's underlying function through FastMCP's own validation
(`fn_metadata.arg_model`), so argument coercion (e.g. "565" -> 565.0) behaves
exactly like the MCP path.

Endpoints (all read-only, matching the read-only Supabase key policy in
`supabase_client.py`):
- GET  /health              -> {"status": "ok"}
- GET  /tools               -> catalog of callable tool names
- POST /chat                -> the AI-frontend endpoint: {"message": ...} (or
    {"text": ...}) → runs the same LangChain ReAct agent defined in
    langchain_agent.py, with the full toolset, and returns {"reply": ...}.
    Needs NVIDIA_API_KEY; without it, /chat returns 503 and everything else
    still works.
- GET  /tools/{name}        -> invoke a tool with query-string args
- POST /tools/{name}        -> invoke a tool with a JSON body
"""
import asyncio
import os
import sys
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError

# Render may run `uvicorn main:app` from the repo root even though the app
# lives in AI-backend/. Ensure local imports (`server`, `design`, etc.) resolve
# regardless of the start directory.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import server  # noqa: E402  (path fix above must run before this import)


_TOOL_MANAGER = server.mcp._tool_manager


app = FastAPI(
    title="Voltra Product Catalog (MCP over HTTP)",
    version="1.1.0",
    description="Read-only HTTP wrapper around the voltra-product-db MCP tools.",
)

# CORS: the AI-frontend (browser) calls this from a different origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "voltra-product-db", "mode": "http-wrapper"}


@app.get("/tools")
def list_tools() -> dict:
    """Advertise callable tool names (metadata only, no data access)."""
    tools = asyncio.run(server.mcp.list_tools())
    return {
        "tools": [
            {"name": t.name, "description": (t.description or "").strip().split("\n")[0]}
            for t in tools
        ]
    }


def _coerce_and_call(name: str, raw_args: dict[str, Any]) -> dict[str, Any]:
    """Validate args with the tool's arg_model, then call the function."""
    manager = _TOOL_MANAGER
    if name not in manager._tools:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown tool '{name}'. GET /tools lists the callable names.",
        )
    tool = manager._tools[name]
    arg_model = tool.fn_metadata.arg_model

    field_names = set(arg_model.model_fields.keys())
    unknown = set(raw_args) - field_names
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unexpected argument(s) {sorted(unknown)} for tool '{name}'; "
                   f"allowed: {sorted(field_names)}.",
        )

    try:
        validated = arg_model.model_validate(raw_args)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors()) from e

    kwargs = validated.model_dump()

    try:
        if tool.is_async:
            output = asyncio.run(tool.fn(**kwargs))
        else:
            output = tool.fn(**kwargs)
    except (HTTPException, ValueError) as e:
        # ValueError raised in-tool (e.g. get_last_updated's arg guard) -> 400
        if isinstance(e, ValueError):
            raise HTTPException(status_code=400, detail=str(e)) from e
        raise
    except Exception as e:
        # Data-layer failures (e.g. Supabase unreachable) surface as 502
        raise HTTPException(status_code=502, detail=f"Tool '{name}' failed: {e}") from e

    return {"tool": name, "result": output}


# --- /chat ---------------------------------------------------------------
# The agent is built lazily on first use so /health and the tool endpoints work
# even if NVIDIA_API_KEY is missing. The built client launches server.py as a
# stdio MCP subprocess — exactly what the terminal chat loop does.
_AGENT = None
_AGENT_ERR: str | None = None


async def _get_agent():
    global _AGENT, _AGENT_ERR
    if _AGENT is not None:
        return _AGENT
    if _AGENT_ERR:
        raise HTTPException(status_code=503, detail=_AGENT_ERR)
    try:
        from langchain_agent import build_agent
        _AGENT = await build_agent()
    except KeyError as e:
        # e.g. os.environ["NVIDIA_API_KEY"] inside build_agent()
        _AGENT_ERR = f"chat agent unavailable: missing environment variable {e}"
        raise HTTPException(status_code=503, detail=_AGENT_ERR) from e
    except Exception as e:
        _AGENT_ERR = f"chat agent unavailable: failed to build: {e}"
        raise HTTPException(status_code=503, detail=_AGENT_ERR) from e
    return _AGENT


class ChatIn(BaseModel):
    """AI-frontend payload: it sends {"message": ...}; {"text": ...} also works."""
    message: str | None = None
    text: str | None = None


@app.post("/chat")
async def chat(payload: ChatIn) -> dict:
    user_text = (payload.message or payload.text or "").strip()
    if not user_text:
        raise HTTPException(
            status_code=400,
            detail="Pass 'message' (or 'text') with the user's question.",
        )

    agent = await _get_agent()

    try:
        # Stateless per message, matching the old Layer-2 service's contract.
        result = await agent.ainvoke({"messages": [("user", user_text)]})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"agent failed: {e}") from e

    reply = result["messages"][-1].content
    return {"reply": reply}


# --- /tools/{name} --------------------------------------------------------
@app.get("/tools/{name}")
def call_tool_get(name: str, request: Request) -> dict:
    args = dict(request.query_params)
    return _coerce_and_call(name, args)


@app.post("/tools/{name}")
def call_tool_post(name: str, payload: dict[str, Any] | None = None) -> dict:
    return _coerce_and_call(name, payload or {})
