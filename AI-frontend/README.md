# AI Frontend - Voltra AI-Engineer

React frontend for the Voltra AI-Engineer solar assistant.

## UI

A dark, NVIDIA-style chat interface (`AIEngineerPage.jsx`) scoped to solar
sizing, batteries, wiring, and panels. The page is self-contained — inline
styles + a scoped `<style>` block own its fonts, colors, layout, hover, and
typing-indicator animations. `src/index.css` is a minimal document reset only.

## Response Logic

`askAIEngineer()` in `AIEngineerPage.jsx` POSTs the user message to the AI-backend
`/chat` endpoint and maps the returned `reply` field to the assistant bubble. The
backend returns `{ intent, intent_label, data, reply }`; only `reply` is shown in
the UI. Failures surface as an inline ⚠️ message in the thread.

## Configuration

The backend URL is read from the `VITE_AI_BACKEND_URL` Vite env var, defaulting to
`http://localhost:8000` for local dev. To target the deployed backend, create a
`.env` file:

```
VITE_AI_BACKEND_URL=https://your-ai-backend.onrender.com
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

The frontend will start at `http://localhost:5173`

## Components

- `AIEngineerPage.jsx` - Main AI-Engineer chat page (starter prompts, message
  thread, typing indicator, scoped disclaimer).
