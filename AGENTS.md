# Solar_Calculator001 — Repository Notes

## Project Structure
- `solar-calculator/` — Main React + Vite frontend (the primary app). Has its own `package.json`.
- `solar-backend/` — Python (FastAPI) backend deployed on Render.
- `AI-backend/` — Read-only MCP server over the Supabase product catalog + LangChain terminal agent (NOT a Render web service, no HTTP endpoints).
- `image-analyzer/` — Image analysis service.
- `AI-frontend/` — Secondary frontend.

## solar-calculator Frontend
- **Stack:** React 19, Vite 8, JSX (not TS). No Tailwind — plain CSS files.
- **Entry:** `src/main.jsx` → imports fonts + `tokens.css` + `index.css` → `App.jsx`.
- **Flow:** 4-step Load Audit wizard (Load → Backup → Charging → Panel) → Result. State in `App.jsx`.
- **Step components:** `src/components/Step1Load.jsx`, `Step2Backup.jsx`, `Step3Voltage.jsx` (unused in flow), `Step4Charging.jsx`, `Step5Panel.jsx`, `Result.jsx`.
- **Design system (NVIDIA dark theme):** Tokens in `src/styles/tokens.css`. Shared UI components in `src/components/ui/` (`Panel`, `Field`, `Button`, `Stepper`).
- **Styling convention:** Use the CSS variables (`--color-*`, `--font-*`, `--clip-*`) and shared `<Panel>/<Field>/<Button>/<Stepper>` components — do NOT hardcode per-screen colors or re-introduce white cards / rounded corners.
- **Self-hosted fonts:** `@fontsource/barlow-condensed`, `@fontsource/inter`, `@fontsource/jetbrains-mono` (chosen over CDN for Nigeria's variable connectivity).

## Commands
- `npm run dev` — Vite dev server (default port 5173).
- `npm run build` — Production build. (Emits a >500kB chunk warning from jspdf — pre-existing, not a blocker.)
- `npm run lint` — ESLint. NOTE: `server.js`/`server2.js` have pre-existing lint errors (no-undef for `process`, unused vars) unrelated to the frontend.

## Git
- Git identity was NOT pre-set in this clone; set locally with `git config user.name "openhands"` / `user.email "openhands@all-hands.dev"`.
- Default branch: `main`.

## Load Audit Architecture (Step 1)
- `Step1Load.jsx` already supports 4 input modes via `activeMode` tab state: `manual` (default searchable-row table), `text` (TextTab.jsx), `pdf` (PdfTab.jsx), `voice` (VoiceTab.jsx). Text/PDF/Voice all funnel through `onParsed` → `ParsedPreview` staging → `confirmParsed` merge into shared `appliances[]`.
- Appliance catalog exists in TWO places (slightly drifted): frontend `APPLIANCES_DATA` in Step1Load.jsx (`{name, category, multiplier, wattage(range str), usesHp}`); backend `APPLIANCE_CATALOG` in solar-backend/main.py (`{name, category, multiplier, usesHp, typical_watts}`). Backend is source of truth for parse matching.
- Parsing: frontend `lib/applianceApi.js` (`parseAppliances`→`/parse-text`, `transcribeAudio`→`/transcribe`); backend `_parse_appliances_from_text` + `_build_parse_prompt`. Backend NEVER converts units; conversion (HP×746, A×240) happens client-side in ParsedPreview/Step1Load.

## solar-backend LLM providers
- **Two providers, picked per endpoint.** Free-text appliance parsing (`/parse-text`) uses **NVIDIA NIM** `openai/gpt-oss-120b` (text-only, OpenAI-compatible, base URL `https://integrate.api.nvidia.com/v1`, env `NVIDIA_API_KEY`). The media endpoints stay on **Groq** because gpt-oss-120b has no vision/audio: `/analyze-adapter` (Groq vision) and `/transcribe` (Groq Whisper).
- **Selection rule** (`_get_text_llm_client`): if `NVIDIA_API_KEY` is set → NVIDIA; else if `GROQ_API_KEY` is set → Groq fallback; else HTTP 500 listing both. `_complete_appliance_parse` isolates the per-provider kwargs (NVIDIA: `reasoning_effort="low"` + `response_format={"type":"json_object"}`, `temp=0.6/top_p=0.9`; Groq: `reasoning_effort="none"`, prompt-constrained JSON). The deterministic `_clean_llm_json`/`_resolve_appliance` post-pass is shared and provider-agnostic.
- **To enable NVIDIA on Render:** add env var `NVIDIA_API_KEY` to the `solar-backend` service. `GROQ_API_KEY` must stay set for the two media endpoints. The `openai` package is in `requirements.txt` alongside `groq`.
- **Limitation:** `openai/gpt-oss-120b` is text-only — do not route `/analyze-adapter` (image) or `/transcribe` (audio) to it.

- Appliance entry shape (the contract every mode must produce): `{ id, applianceName(str), wattage(str), horsepower(str), quantity(int), selectedAppliance:{name,category,multiplier,usesHp}|null }`.
- State flow: App.jsx `formData` (load, switching_volt, backup_hours, battery_type, battery_eff, charging_hours, panel_wattage, other_wattage). Step1Load keeps LOCAL `appliances[]` (seeded from `data.appliances`). On submit → `onChange({load:total, switching_volt, appliances, applianceDetails})` + `onNext()`. Only `load`+`switching_volt` are sent to backend `/calculate`; appliances/applianceDetails ride on formData for Result display.
- Styling: NVIDIA dark theme via `tokens.css` (`--color-*`, `--font-*`, `--clip-panel`/`--clip-btn`). Shared UI: `Panel`/`Field`/`Button`/`Stepper` in `src/components/ui/`. Step1Load's own UI (load meter, mode tabs, appliance table, buttons) uses GLOBAL App.css classnames — NOT CSS modules, NOT Tailwind. Each tab has a co-located `.css` (TextTab.css, VoiceTab.css, PdfTab.css, ParsedPreview.css). Convention: co-located plain CSS using shared tokens + global App.css utility classes (`.btn-submit`, `.btn-tab-action`, `.btn-outline`, `.mode-tab`, `.category-tag`, `.source-tag`, `.step-eyebrow`, `.step-description`).
- "LoadMeter" is NOT a separate component — it's inline JSX inside Step1Load.jsx (`.load-meter` block + `calculateTotalLoad`/tier `useMemo` logic), tightly coupled to Step1Load's local `appliances[]` state and the `TIERS` table. Not exported/reusable as-is.

## AI-backend (Voltra product-DB MCP server + LangChain agent)
- **Replaced 2026-08-21:** the old FastAPI "Layer 2" service (`main.py` + `services/`, `/chat` + `/health`, intent-extraction pipeline, Render/Procfile) was fully removed. The new backend is a **read-only MCP server over the Supabase `products` catalog** plus a **LangChain stdio agent** — flat layout, no HTTP server, no Render deployment files.
- **Modules:** `server.py` (FastMCP `voltra-product-db`, 13 read-only tools), `supabase_client.py` (lazy client, read-only queries), `design.py` (engineering-target→catalog composition; panel matching works, battery/inverter raise `SchemaNotConfirmedError` on purpose), `Engineering.py` (capital E — imported as `import Engineering`; deterministic cable sizing/safety checks), `langchain_agent.py` (MultiServerMCPClient launches `server.py` as a stdio subprocess; run `python langchain_agent.py`).
- **Docs:** `SCHEMA_ASSUMPTIONS.md` (confirmed products-table schema; only `power` is numeric-safe, `rating`/`voltage`/`current`/`capacity` are unit-baked free text), `REFERENCE_DATA_NEEDED.md` (ampacity table + battery/inverter sample rows needed to unblock stubs).
- **LLM provider: NVIDIA NIM** via `langchain_openai.ChatOpenAI` (base URL `https://integrate.api.nvidia.com/v1`, model `NVIDIA_MODEL` default `nvidia/nemotron-3.5-lightning-30b-a3b`, temp 0). Groq alternative kept as commented code.
- **Env vars:** `SUPABASE_URL` + `SUPABASE_KEY` (must be a READ-ONLY key — enforced at RLS/credential level, code has no write ops by design) + `NVIDIA_API_KEY`. `.env` is gitignored at repo root; `.env.example` documents all three.
- **Known data gaps (intentional, not bugs):** `Engineering.AMPACITY_TABLE` is empty → ampacity/safety checks report `insufficient_reference_data`; `design.CATEGORY_NAMES` battery/inverter names ("Batteries"/"Inverters") are unconfirmed guesses.
- **Deps:** mcp, supabase, langchain, langgraph, langchain-groq, langchain-mcp-adapters, python-dotenv + `langchain-openai` and `rich` (added beyond the original spec — `langchain_agent.py` imports both; without them the agent can't run).
- **AI-frontend:** Vite + React 19 chat (`AI-frontend/src/components/AIEngineerPage.jsx`) — the Voltra AI-Engineer UI. Self-contained dark green NVIDIA-style chat: inline styles + a scoped `<style>` block own fonts/colors/layout/hover/typing animations; `src/index.css` is a minimal document reset only (no global theme classes). `askAIEngineer()` is a keyword-matching STUB (no backend wired yet) — NOTE: the old AI-backend `/chat` endpoint is gone; wiring now requires an HTTP wrapper around the MCP tools or a new endpoint elsewhere. Old `Chat.jsx` + purple-gradient `index.css` were removed. `main.jsx` → `<AIEngineerPage />`. Title: "Voltra AI-Engineer".
