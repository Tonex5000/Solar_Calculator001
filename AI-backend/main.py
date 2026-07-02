"""
AI Solar Assistant Backend - Layer 2
FastAPI server with Intent Detection + Structured Output System
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

# Import services
from services.ai_extractor import extract_intent, get_intent_label
from services.ai_responder import generate_reply

load_dotenv()

app = FastAPI(title="AI Solar Assistant - Layer 2", version="2.0.0")

# CORS middleware - allow frontend access from all origins
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(www\.)?.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    intent: str
    intent_label: str
    data: dict
    reply: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "AI Solar Assistant Layer 2"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat message with Intent Detection + Structured Output.
    
    Flow:
    1. Extract intent and structured data from user input (AI)
    2. Generate conversational response using extracted data (AI)
    3. Return all three: intent, data, and reply
    
    Args:
        request: ChatRequest with user's message
        
    Returns:
        ChatResponse with intent, structured data, and AI reply
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(
            status_code=500, 
            detail="Groq API key not configured. Please set GROQ_API_KEY in .env"
        )
    
    try:
        # Step 1: Extract intent and structured data
        structured_data = extract_intent(request.message)
        
        # Step 2: Generate response using extracted data
        reply = generate_reply(request.message, structured_data)
        
        # Step 3: Return complete response
        return ChatResponse(
            intent=structured_data["intent"],
            intent_label=get_intent_label(structured_data["intent"]),
            data=structured_data["data"],
            reply=reply
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
