"""
Solar System Sizing Calculator API

A FastAPI backend for calculating solar system components based on load
requirements, plus an image-analysis endpoint that reads a power adapter's
label (via Groq's vision model) to auto-detect its wattage.
"""
import base64
import json
import math
import os
from math import ceil
from typing import Literal, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from groq import Groq

# Constants
BATTERY_RATED_VOLTAGE = 12  # 12V batteries for battery count estimation
BATTERY_RATED_CAPACITY = 220  # 200Ah batteries

GROQ_MODEL = "llama-3.1-8b-instant"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


class SolarCalculationInput(BaseModel):
    """Input model for solar system sizing calculation."""

    load: float = Field(
        ...,
        gt=0,
        description="Total load in watts",
        examples=[1000, 2500, 5000],
    )
    backup_hours: float = Field(
        ...,
        ge=1,
        le=12,
        description="Number of hours the system should run (1-12)",
        examples=[4, 8, 12],
    )
    battery_type: Literal["tubular", "lithium"] = Field(
        ...,
        description="Type of battery (tubular or lithium)",
        examples=["tubular", "lithium"],
    )
    battery_eff: float = Field(
        ...,
        ge=0.75,
        le=1,
        description="Battery efficiency (0.8 for tubular, 0.95 for lithium)",
        examples=[0.8, 0.95],
    )
    switching_volt: int = Field(
        ...,
        gt=0,
        description="Inverter switching voltage based on recommended inverter size",
        examples=[12, 24, 48, 96, 120, 180, 240, 360],
    )
    charging_hours: float = Field(
        ...,
        ge=1,
        le=12,
        description="Number of hours available to charge battery (1-12)",
        examples=[4, 6, 8],
    )
    panel_wattage: int = Field(
        ...,
        gt=0,
        description="Wattage of a single solar panel (e.g., 300, 400, 550)",
        examples=[400, 550],
    )


class SolarCalculationOutput(BaseModel):
    """Output model for solar system sizing calculation."""

    inverter_watts: float = Field(..., ge=0, description="Required inverter size in watts")
    inverter_kva: float = Field(..., ge=0, description="Required inverter size in kVA")
    battery_ah: float = Field(..., ge=0, description="Required battery capacity in amp-hours")
    solar_watts: float = Field(..., ge=0, description="Required solar array size in watts")
    number_of_panels: int = Field(..., ge=1, description="Number of solar panels required")
    battery_count: int = Field(..., ge=1, description="Total number of batteries required")
    battery_type: str = Field(..., description="Type of battery selected")
    series_connection: int = Field(..., ge=1, description="Number of batteries in series connection (for tubular)")
    parallel_connection: int = Field(..., ge=1, description="Number of batteries in parallel connection (for tubular)")
    battery_cap: float = Field(..., ge=0, description="Total battery bank capacity in Wh")


class AdapterAnalysisOutput(BaseModel):
    """Output model for the adapter-label image analysis."""

    model: Optional[str] = Field(None, description="Adapter model number, if readable")
    input_voltage: Optional[str] = Field(None, description="Input voltage/frequency as printed")
    input_current: Optional[str] = Field(None, description="Input current as printed")
    output_voltage: Optional[str] = Field(None, description="Output voltage as printed")
    output_current: Optional[str] = Field(None, description="Output current as printed")
    wattage: Optional[str] = Field(None, description="Wattage as printed, e.g. '10.0W'")
    wattage_value: Optional[float] = Field(None, description="Wattage as a plain number of watts")


# Initialize FastAPI app
app = FastAPI(
    title="Solar System Sizing Calculator",
    description=(
        "API for calculating solar system components based on load requirements, "
        "backup needs, and solar panel specifications. Also supports reading a "
        "device's power adapter label from a photo to auto-detect its wattage."
    ),
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for frontend access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "service": "Solar System Sizing Calculator"}


@app.post(
    "/calculate",
    response_model=SolarCalculationOutput,
    tags=["Calculator"],
    summary="Calculate solar system sizing",
    description="Calculate inverter size, battery capacity, solar array size, and number of panels based on load and backup requirements.",
)
async def calculate_solar_system(input_data: SolarCalculationInput) -> SolarCalculationOutput:
    """
    Calculate solar system components.

    Performs the following calculations:
    1. Energy required (Wh) = load (W) x backup_hours
    2. Battery capacity (Ah) = energy (Wh) / switching_volt (V)
    3. Inverter size (W) = load x 2 / battery_eff
    4. Solar size (W) = adjusted_energy (Wh) / charging_hours
    5. Number of panels = ceil(solar_watts / panel_wattage)

    For TUBULAR batteries:
    - Series connection = switching_volt / 12V (per battery)
    - Parallel connection = total_battery_ah / (switching_volt x 220)
    - Battery count = series_connection x parallel_connection

    For LITHIUM batteries:
    - Series connection = switching_volt / 12V
    - Parallel connection = total_battery_ah / BATTERY_RATED_CAPACITY
    - Battery count = series x parallel
    """

    # Extract validated inputs
    load = input_data.load
    backup_hours = input_data.backup_hours
    battery_type = input_data.battery_type
    battery_eff = 0.8
    switching_volt = input_data.switching_volt
    charging_hours = input_data.charging_hours
    panel_wattage = input_data.panel_wattage

    def custom_round(number):
        whole = int(number)
        decimal = number - whole

        if decimal < 0.5:
            return whole
        else:
            return whole + 1

    def add_if_prime(n):
        if n < 2:
            return n

        for i in range(2, int(math.sqrt(n)) + 1):
            if n % i == 0:
                return n  # Not prime

        return n + 1

    # Validate charging hours is not zero
    if charging_hours <= 0:
        raise HTTPException(
            status_code=400,
            detail="Charging hours must be greater than zero",
        )

    # Calculate base energy requirement
    energy_wh = load * backup_hours

    # Calculate total battery capacity needed in Ah (using switching_volt as system voltage)
    battery_ah = energy_wh / 0.8

    # Calculate inverter size (with 100% headroom for surge capacity)
    # Convert to kVA (assuming power factor of 0.8)
    inverter_watts = (load * 2) / battery_eff
    inverter_kva = inverter_watts / 1000

    # Calculate series connection = switching_volt / 12V (per battery)
    series_connection = switching_volt / 12

    # Calculate battery connections based on battery type
    if battery_type == "tubular":
        # Parallel connection = total_battery_ah / (switching_volt * 220)
        parallel_connection = custom_round(battery_ah / (switching_volt * 220))
        parallel_connection = max(parallel_connection, 1)  # Minimum 1

        # Total battery count = series x parallel
        battery_count = series_connection * parallel_connection
    else:
        # Lithium batteries - typically come as single units/packs
        # Parallel connection based on capacity needed
        parallel_connection = ceil(battery_ah / BATTERY_RATED_CAPACITY)
        parallel_connection = max(parallel_connection, 1)  # Minimum 1

        # Total battery count
        battery_count = series_connection * parallel_connection

    # Apply system loss factor (based on battery efficiency)
    battery_cap = switching_volt * (parallel_connection * 220)

    # Calculate solar array size using adjusted energy
    solar_watts = battery_cap / charging_hours

    # Calculate number of panels (round up)
    number_of_panels = custom_round(solar_watts / panel_wattage)

    return SolarCalculationOutput(
        inverter_watts=round(inverter_watts, 1),
        inverter_kva=round(inverter_kva, 2),
        battery_ah=round(battery_ah, 2),
        solar_watts=round(solar_watts, 2),
        number_of_panels=add_if_prime(number_of_panels),
        battery_count=battery_count,
        battery_type=battery_type,
        series_connection=series_connection,
        parallel_connection=parallel_connection,
        battery_cap=battery_cap,
    )


# ---------------------------------------------------------------------------
# Adapter label image analysis (Groq vision)
# ---------------------------------------------------------------------------

def _guess_mime_type(filename: str, fallback: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, fallback or "image/jpeg")


def _extract_wattage_from_image(image_bytes: bytes, mime_type: str) -> dict:
    """Send the image to Groq's vision model and parse the label specs."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured on the server",
        )

    client = Groq(api_key=api_key)

    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    prompt = (
        "You are looking at a photo of a power adapter's printed label. "
        "Read the text on the label carefully and extract the electrical "
        "specifications. Compute the wattage if it isn't printed directly "
        "(Watts = Volts x Amps). "
        "Respond with ONLY a valid JSON object, no extra text, no markdown "
        "fences, in this exact shape:\n"
        "{\n"
        '  "model": "<model number or null>",\n'
        '  "input_voltage": "<e.g. 100-240V~, 50/60Hz>",\n'
        '  "input_current": "<e.g. 0.35A>",\n'
        '  "output_voltage": "<e.g. 5.0V>",\n'
        '  "output_current": "<e.g. 2.0A>",\n'
        '  "wattage": "<e.g. 10.0W>",\n'
        '  "wattage_value": <number, watts as a float>\n'
        "}\n"
        "If a field truly cannot be read, use null for it."
    )

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            temperature=0,
            max_tokens=500,
        )
    except Exception as exc:  # groq client raises its own exception types
        raise HTTPException(status_code=502, detail=f"Groq API error: {exc}") from exc

    raw = response.choices[0].message.content.strip()

    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail=f"Could not parse a JSON response from Groq. Raw response: {raw}",
        )


@app.post(
    "/analyze-adapter",
    response_model=AdapterAnalysisOutput,
    tags=["Adapter Analysis"],
    summary="Read a power adapter's wattage from a photo",
    description=(
        "Upload a photo of a power adapter's label. Groq's vision model reads "
        "the printed specs and returns the wattage (computed from V x A if not "
        "printed directly), which you can then pass as `load` to /calculate."
    ),
)
async def analyze_adapter(file: UploadFile = File(...)) -> AdapterAnalysisOutput:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: {sorted(ALLOWED_IMAGE_TYPES)}",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    mime_type = _guess_mime_type(file.filename or "", file.content_type)
    result = _extract_wattage_from_image(image_bytes, mime_type)

    return AdapterAnalysisOutput(**result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
