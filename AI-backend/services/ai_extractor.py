"""
AI Intent Detection and Data Extraction Service
Extracts structured data from user input about solar energy
"""

import json
from groq import Groq
import os

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Supported intents
SUPPORTED_INTENTS = [
    "budget_planning",
    "load_estimation", 
    "problem_diagnosis",
    "cost_comparison",
    "general_question"
]

# System prompt for intent classification and data extraction
EXTRACTION_PROMPT = """You are an AI that extracts structured data from user queries about solar energy in Nigeria.

## Your Task
Analyze the user input and extract relevant information into a strict JSON format.

## Supported Intents
1. budget_planning - User wants to know what they can afford or what costs what
2. load_estimation - User wants to know power requirements or load calculations
3. problem_diagnosis - User has an issue with their solar system
4. cost_comparison - User wants to compare costs between options
5. general_question - Any other solar-related question

## Data Fields to Extract
- budget: number (Nigerian Naira), extract from text (e.g., "500k" = 500000, "₦50,000" = 50000)
- appliances: array of strings (common: fridge, tv, ac, fan, laptop, phone, iron, freezer, washing machine, water pump, etc.)
- problem: string (describe the issue if intent is problem_diagnosis)
- comparison: string (what is being compared if intent is cost_comparison)

## Rules
1. ALWAYS return valid JSON only - no explanations, no markdown, no extra text
2. If no budget mentioned, set budget to null
3. If no appliances mentioned, return empty array for appliances
4. Be conservative - infer only obvious values, do NOT hallucinate
5. Currency formats to recognize:
   - "₦500k" or "500k" or "500K" = 500000
   - "₦50,000" or "50000" = 50000
   - "half million" = 500000
   - "N500,000" = 500000

## Output Format (strict JSON)
{
  "intent": "one of the supported intents",
  "data": {
    "budget": number or null,
    "appliances": ["array", "of", "strings"] or [],
    "problem": "string describing the problem" or null,
    "comparison": "string describing what's being compared" or null
  }
}

## Examples

Input: "I have ₦500k and a fridge"
Output: {"intent": "budget_planning", "data": {"budget": 500000, "appliances": ["fridge"], "problem": null, "comparison": null}}

Input: "My inverter drains fast"
Output: {"intent": "problem_diagnosis", "data": {"budget": null, "appliances": [], "problem": "inverter battery draining fast", "comparison": null}}

Input: "What can I power with 300k?"
Output: {"intent": "budget_planning", "data": {"budget": 300000, "appliances": [], "problem": null, "comparison": null}}

Input: "How much for solar panel?"
Output: {"intent": "cost_comparison", "data": {"budget": null, "appliances": [], "problem": null, "comparison": "solar panel cost"}}

Input: "What's the best inverter?"
Output: {"intent": "general_question", "data": {"budget": null, "appliances": [], "problem": null, "comparison": null}}

Input: "I want to power my TV and 2 fans"
Output: {"intent": "load_estimation", "data": {"budget": null, "appliances": ["tv", "fan", "fan"], "problem": null, "comparison": null}}
"""


def parse_currency(text: str) -> float | None:
    """
    Parse Nigerian Naira currency from text.
    """
    import re
    
    # Remove currency symbols and spaces
    text = text.replace('₦', '').replace('N', '').replace(' ', '')
    
    # Match patterns like "500k", "500K", "500,000", "500000"
    k_match = re.search(r'(\d+(?:\.\d+)?)\s*k\b', text, re.IGNORECASE)
    if k_match:
        return float(k_match.group(1)) * 1000
    
    million_match = re.search(r'(\d+(?:\.\d+)?)\s*m\b', text, re.IGNORECASE)
    if million_match:
        return float(million_match.group(1)) * 1000000
    
    # Remove commas and try to parse as number
    clean_text = text.replace(',', '')
    if clean_text.isdigit():
        return float(clean_text)
    
    return None


def extract_intent(user_input: str) -> dict:
    """
    Extract intent and structured data from user input.
    
    Args:
        user_input: The user's message/text
        
    Returns:
        dict with intent and data fields
    """
    # Fallback structure
    fallback = {
        "intent": "general_question",
        "data": {
            "budget": None,
            "appliances": [],
            "problem": None,
            "comparison": None
        }
    }
    
    if not user_input or not user_input.strip():
        return fallback
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": EXTRACTION_PROMPT},
                {"role": "user", "content": user_input}
            ],
            temperature=0.1,  # Low temperature for consistency
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        
        # Parse the JSON response
        try:
            result = json.loads(result_text)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                return fallback
        
        # Validate the structure
        if not isinstance(result, dict):
            return fallback
        
        # Ensure all required fields exist
        validated = {
            "intent": result.get("intent", "general_question") if result.get("intent") in SUPPORTED_INTENTS else "general_question",
            "data": {
                "budget": result.get("data", {}).get("budget") if isinstance(result.get("data"), dict) else None,
                "appliances": result.get("data", {}).get("appliances", []) if isinstance(result.get("data"), dict) else [],
                "problem": result.get("data", {}).get("problem") if isinstance(result.get("data"), dict) else None,
                "comparison": result.get("data", {}).get("comparison") if isinstance(result.get("data"), dict) else None
            }
        }
        
        return validated
        
    except Exception as e:
        print(f"Intent extraction error: {e}")
        return fallback


def get_intent_label(intent: str) -> str:
    """
    Get a human-readable label for an intent.
    """
    labels = {
        "budget_planning": "💰 Budget Planning",
        "load_estimation": "⚡ Load Estimation",
        "problem_diagnosis": "🔧 Problem Diagnosis",
        "cost_comparison": "📊 Cost Comparison",
        "general_question": "💬 General Question"
    }
    return labels.get(intent, intent)
