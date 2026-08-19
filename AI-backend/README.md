# AI Backend - Solar Assistant

FastAPI backend for the AI-powered Nigerian Solar Assistant using the NVIDIA NIM API (OpenAI-compatible).

## Setup

1. Install dependencies:
```bash
pip install --upgrade pip
pip install fastapi "uvicorn[standard]" openai python-dotenv
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Add your NVIDIA API key to `.env`:
```
NVIDIA_API_KEY=your_actual_api_key_here
```

Optional overrides (defaults shown):
```
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
```

4. Run the server:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

The server will start at `http://localhost:8000`

## API Endpoints

### POST /chat
Send a message and get an AI response.

**Request:**
```json
{
  "message": "What inverter do I need for my 3 bedroom flat?"
}
```

**Response:**
```json
{
  "reply": "For a 3 bedroom flat in Nigeria..."
}
```

### GET /health
Health check endpoint.

## System Prompt

The AI acts as a Nigerian solar energy expert who:
- Understands NEPA/grid instability issues
- Knows about generator usage and limitations
- Can troubleshoot battery and inverter problems
- Is cost-conscious (thinks in ₦)
- Gives practical, simple explanations
- Thinks like a local solar installer

## Model

Uses `nvidia/nemotron-3.5-lightning-30b-a3b` from the NVIDIA NIM API (OpenAI-compatible) for fast, intelligent responses. Override with the `NVIDIA_MODEL` env var if needed.
