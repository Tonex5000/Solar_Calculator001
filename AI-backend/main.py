"""
AI Solar Assistant Backend
FastAPI server for Nigerian Solar Expert AI
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import openai
import os

load_dotenv()

app = FastAPI(title="AI Solar Assistant", version="1.0.0")

# CORS middleware - allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# System prompt for Nigerian Solar Expert
SYSTEM_PROMPT = """You are a friendly and knowledgeable Nigerian solar energy expert assistant. 

You understand:
- Nigerian power challenges (NEPA Eko Disco, Ikeja Electric, etc.)
- Grid instability and frequent outages
- Generator usage and fuel costs
- Battery and inverter troubleshooting
- Solar panel installation in Nigerian context
- Cost considerations in Nigerian Naira (₦)

Your approach:
- Be practical, not theoretical - give actionable advice
- Use simple, clear English (avoid jargon when possible)
- Think like a local solar installer who knows Nigerian realities
- Consider cost-effectiveness (₦) in every recommendation
- Be honest about limitations and potential issues
- Suggest realistic solutions for Nigerian homes and businesses

Always respond in a helpful, conversational tone as if you're advising a friend."""
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "AI Solar Assistant"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat message and return AI response.
    
    Args:
        request: ChatRequest with user's message
        
    Returns:
        ChatResponse with AI's reply
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=500, 
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY in .env"
        )
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": request.message}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        reply = response.choices[0].message.content
        return ChatResponse(reply=reply)
    
    except openai.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid OpenAI API key")
    
    except openai.RateLimitError:
        raise HTTPException(status_code=429, detail="OpenAI rate limit exceeded")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
