"""
AI Response Generation Service
Generates conversational responses based on structured data
"""

from openai import OpenAI
import os
import re

NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")

# Construct lazily-tolerant: allow app to import even without a key so the
# /health endpoint and the missing-key guard in main.py still work. A real
# call without a key will fail fast with a clear auth error at request time.
client = OpenAI(
    api_key=os.getenv("NVIDIA_API_KEY") or "not-configured",
    base_url=NVIDIA_BASE_URL,
)

# System prompt for the responder - Nigerian Solar Expert
RESPONDER_PROMPT = """You are a friendly and knowledgeable Nigerian solar energy expert assistant.

You understand:
- Nigerian power challenges (NEPA/Eko Disco/Ikeja Electric, etc.)
- Grid instability and frequent outages
- Generator usage and fuel costs
- Battery and inverter troubleshooting
- Solar panel installation in Nigerian context
- Cost considerations in Nigerian Naira (₦)

You have been provided with EXTRACTED DATA from the user's message. Use this data to give personalized, accurate responses.

## Extracted Data Available:
- budget: The user's budget in Naira (if mentioned)
- appliances: List of appliances the user mentioned
- problem: The specific problem they're facing (if any)
- comparison: What they want to compare (if any)

## Your Approach:
1. Be practical, not theoretical - give actionable advice
2. Use simple, clear English (avoid jargon when possible)
3. Think like a local solar installer who knows Nigerian realities
4. Be cost-conscious - always consider ₦ in your recommendations
5. Be honest about limitations and potential issues
6. Suggest realistic solutions for Nigerian homes and businesses
7. Reference the extracted data when providing advice

## Response Guidelines:
- If budget is provided, suggest options within that range
- If appliances are mentioned, discuss their power needs
- If a problem is described, diagnose and suggest solutions
- If user asks about cost comparison, give practical comparisons
- Always be helpful and conversational

Keep responses concise but informative. Aim for 2-4 paragraphs max."""


def generate_reply(user_input: str, structured_data: dict) -> str:
    """
    Generate an AI response based on user input and extracted structured data.
    
    Args:
        user_input: The original user message
        structured_data: Dict containing intent and extracted data
        
    Returns:
        str: The AI-generated response
    """
    if not user_input or not user_input.strip():
        return "I didn't catch that. Could you please describe your solar energy question or need?"
    
    # Build context from extracted data
    data = structured_data.get("data", {})
    intent = structured_data.get("intent", "general_question")
    
    # Create a context summary for the AI
    context_parts = []
    
    if data.get("budget"):
        context_parts.append(f"User Budget: ₦{data['budget']:,.0f}")
    
    if data.get("appliances"):
        apps = ", ".join(data["appliances"])
        context_parts.append(f"Appliances mentioned: {apps}")
    
    if data.get("problem"):
        context_parts.append(f"Problem: {data['problem']}")
    
    if data.get("comparison"):
        context_parts.append(f"Comparison topic: {data['comparison']}")
    
    context = "\n".join(context_parts) if context_parts else "No specific data extracted."
    
    # Create the full prompt
    full_prompt = f"""Original user message: "{user_input}"

Detected Intent: {intent}

Extracted Data:
{context}

Please respond to the user based on their message and the extracted data above. Be practical and helpful."""
    
    try:
        response = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": RESPONDER_PROMPT},
                {"role": "user", "content": full_prompt}
            ],
            temperature=0.7,
            max_tokens=16384,
            extra_body={
                    "chat_template_kwargs": {"enable_thinking": True},
                    "reasoning_budget": 16384
                }
        )
        message = response.choices[0].message
        reply = getattr(message, "content", "") or ""
        reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
        return reply
        
    except Exception as e:
        print(f"Response generation error: {e}")
        return "I'm having trouble generating a response right now. Please try again or rephrase your question."
