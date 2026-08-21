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
- POST /chat                -> {"text": ...} sent to a named tool (the AI-frontend
                               should use dedicated endpoints instead; this is a
                               generic fallback)
- GET  /tools/{name}        -> invoke a tool with query-string args
- POST /tools/{name}        -> invoke a tool with a JSON body
"""
import asyncio
import os
import sys
from typing import Any

from fastapi import FastAPI, HTTPException, Request
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
    version="1.0.0",
    description="Read-only HTTP wrapper around the voltra-product-db MCP tools.",
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
# Deterministic free-text dispatcher: the AI-frontend uses dedicated endpoints
# today; this endpoint maps {"text", "tool"} to a single-name tool call using
# the most common argument the tool accepts, and it says so in the response.
# Hard-rejects empty text like the old /chat for API-contract familiarity.
class ChatTextIn(BaseModel):
    text: str
    tool: str = "search_products"


@app.post("/chat")
def chat(payload: ChatTextIn) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text cannot be empty")

    # Route by keyword relevance to a catalog-ish tool. Most tools take a
    # scalar first arg; pick the arg name that best matches the tool's use.
    tool = payload.tool
    manager = _TOOL_MANAGER
    if tool not in manager._tools:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tool '{tool}'. GET /tools lists callable names.",
        )
    arg_model = manager._tools[tool].fn_metadata.arg_model
    fields = list(arg_model.model_fields.keys())

    # Prefer a string-ish first field (category/manufacturer/id); otherwise
    # fall back to the single field that's declared required with no default.
    chosen = next(
        (f for f in fields if f in ("category", "manufacturer", "product_id", "product_ids")),
        fields[0] if fields else None,
    )
    arg_value: Any = [text] if chosen == "product_ids" else text
    result = _coerce_and_call(tool, {chosen: arg_value} if chosen else {})
    return {"reply": result["result"], "tool": tool, "arg_used": chosen}


# --- /tools/{name} --------------------------------------------------------
@app.get("/tools/{name}")
def call_tool_get(name: str, request: Request) -> dict:
    args = dict(request.query_params)
    return _coerce_and_call(name, args)


@app.post("/tools/{name}")
def call_tool_post(name: str, payload: dict[str, Any] | None = None) -> dict:
    return _coerce_and_call(name, payload or {})
