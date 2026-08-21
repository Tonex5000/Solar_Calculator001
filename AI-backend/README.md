# Voltra product-DB MCP server + LangChain agent


Read-only MCP server over your Supabase solar-component database, plus a
LangChain agent that connects to it.


## Scope


14 tools now:


**Catalog (Supabase-backed, fully functional):** `search_products`,
`get_product`, `get_categories`, `get_cheapest_match`, `get_price_range`,
`compare_products`, `get_supplier_info`, `check_stock_availability`,
`get_last_updated`, `get_peak_sun_hours` (NASA POWER climatology + regional
fallback for system sizing).


**Design/engineering (new):** `match_design_to_catalog`,
`solve_budget_design` — functional for panels, stubbed for battery/inverter
pending schema confirmation (see `mcp_server/REFERENCE_DATA_NEEDED.md`).
`size_cable`, `check_system_safety` — voltage-drop math is real and
trustworthy now; ampacity/safety checks report `insufficient_reference_data`
until you load a real ampacity table (same doc).


Still not covered: `calculate_system`, `parse_appliance_text`,
`save_to_load_audit`, `request_engineer_callback` — those live in
solar-backend or the frontend session, not this database, and need their
own MCP server or REST wrapper.


## Setup


1. Read `mcp_server/SCHEMA_ASSUMPTIONS.md` — the schema is now confirmed
   against a real data export (not guessed), but there's one open question
   flagged there about other categories that affects what you should
   verify before relying on this in production.
2. `pip install -r requirements.txt`
3. `cp .env.example .env` and fill in real values. **Use a read-only
   Supabase key** — see the comment in `.env.example` and the docstring in
   `supabase_client.py` for why.
4. `python agent/langchain_agent.py` to start a terminal chat loop.

### HTTP deployment (Render)

`main.py` is a thin FastAPI wrapper that re-exposes the same 13 MCP tools
over HTTP (`GET /health`, `GET /tools`, `GET|POST /tools/{name}`,
`POST /chat`), so Render can run `uvicorn main:app` even though the
backend's source of truth is the stdio MCP server in `server.py`.


## Why no write tools


An LLM with write access to a live pricing database is a real integrity
risk — a hallucinated tool call, or user chat text that gets misread as an
update instruction, can silently corrupt pricing every future
recommendation depends on. If you need add/update/delete, build those as a
separate admin-only script or MCP server that the customer-facing agent
can't reach, and enforce it with a genuinely restricted Supabase key, not
just by omitting the tool in code.


## What's stubbed vs. real


Everything in this repo talks to your actual Supabase data — none of it is
a demo/mock like the earlier frontend prototypes (LoadAuditChat.jsx,
Landing.jsx, AIEngineerPage.jsx). The schema is confirmed against a real
export, not assumed.


## Open question that still needs an answer from you


**Read `mcp_server/REFERENCE_DATA_NEEDED.md` first** — it's the actionable
version of everything below, in the exact format the code expects.


The confirmed schema is from the "Solar Panels" category only. `power` is
a clean numeric column there, but `rating`/`voltage`/`current`/`capacity`
are free-text strings with units baked in (e.g. "13.9A Imp"). Before
trusting battery/inverter matching in `match_design_to_catalog` or
`solve_budget_design`:


- Paste one sample row each for "battery" and "inverter" (or whatever your
  real category names are — `CATEGORY_NAMES` in `design.py` currently
  guesses "Batteries"/"Inverters").
- Also paste the real output of `get_categories()` once your `.env` is
  filled in, to confirm those guessed names.


And for real safety-checked cable sizing, you need to source an ampacity
table — format specified in `REFERENCE_DATA_NEEDED.md`.
