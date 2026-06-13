import os
import base64
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel
from typing import Optional
import json

app = FastAPI(title="Solar Calculator AI Vision API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
groq_api_key = os.getenv("GROQ_API_KEY", "")
client = Groq(api_key=groq_api_key) if groq_api_key else None


class AnalysisResult(BaseModel):
    wattage: Optional[float] = None
    confidence: Optional[str] = None
    raw_text: str
    calculation: str


@app.get("/")
async def root():
    return {"message": "Solar Calculator AI Vision API", "status": "running"}


@app.get("/api/health")
async def health_check():
    if not groq_api_key:
        return {"status": "warning", "message": "GROQ_API_KEY not configured"}
    return {"status": "ok", "message": "AI Vision API is running"}


@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not groq_api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY not configured. Please set the environment variable."
        )
    
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image file
        image_bytes = await file.read()
        
        # Convert to base64
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{base64_image}"
        
        # Call Groq API
        prompt = """You are analyzing an image of an appliance label, data plate, or electrical rating plate.
              
Your task is to extract the power/wattage information from this image.

Look for:
- Direct wattage (W)
- Calculate from Voltage (V) × Amps (A) = Watts
- Horsepower (HP) to Watts conversion (1 HP ≈ 746W)
- BTU ratings for AC units (for rough estimation)

Return a JSON response with this exact format:
{
  "wattage": <number or null>,
  "confidence": "high" | "medium" | "low" | null,
  "raw_text": "<extracted text showing power info>",
  "calculation": "<how wattage was determined if calculated>"
}

If no power information is found, return:
{
  "wattage": null,
  "confidence": null,
  "raw_text": "<what you see on the label>",
  "calculation": "No power information found"
}

Be precise and only report what you can clearly see."""

        completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            model="llama-3.2-11b-vision-preview",
            temperature=0.1,
            max_tokens=500
        )
        
        response_text = completion.choices[0].message.content or ""
        
        # Parse JSON response
        try:
            # Try to extract JSON from the response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group(0))
            else:
                raise ValueError("No JSON found")
        except (json.JSONDecodeError, ValueError):
            # If JSON parsing fails, return the raw response
            result = {
                "wattage": None,
                "confidence": None,
                "raw_text": response_text,
                "calculation": "Failed to parse AI response"
            }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3001"))
    uvicorn.run(app, host="0.0.0.0", port=port)