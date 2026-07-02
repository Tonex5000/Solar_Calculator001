# AI Backend - Solar Assistant

FastAPI backend for the AI-powered Nigerian Solar Assistant.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_actual_api_key_here
```

4. Run the server:
```bash
uvicorn main:app --reload
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
