# Solar_Calculator001 — Repository Notes

## Project Structure
- `solar-calculator/` — Main React + Vite frontend (the primary app). Has its own `package.json`.
- `solar-backend/`, `AI-backend/` — Python (FastAPI/Flask) backends deployed on Render.
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
