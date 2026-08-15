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
import re
from math import ceil
from typing import Literal, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from groq import Groq

# Constants
BATTERY_RATED_VOLTAGE = 12  # 12V batteries for battery count estimation
BATTERY_RATED_CAPACITY = 220  # 200Ah batteries

GROQ_MODEL = "qwen/qwen3.6-27b"
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
            max_completion_tokens=500,
        )
    except Exception as exc:  # groq client raises its own exception types
        raise HTTPException(status_code=502, detail=f"Groq API error: {exc}") from exc

    raw = response.choices[0].message.content.strip()

    # Reasoning models (like qwen3.6) emit a <think>...</think> block before
    # the actual answer - strip it out if present.
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, flags=re.DOTALL)
    if fence_match:
        raw = fence_match.group(1)
    elif raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Last resort: grab the first {...} block found anywhere in the text
        brace_match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

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


# ---------------------------------------------------------------------------
# Appliance parsing from free text / transcripts (Groq LLM)
# ---------------------------------------------------------------------------

# The catalog the frontend's manual search uses. Embedded in the prompt so the
# LLM returns the correct category + multiplier + usesHp for each appliance it
# recognises, making parsed rows mathematically identical to manual selection.
APPLIANCE_CATALOG = [
    {"name": "Air Conditioner",   "category": "Inductive", "multiplier": 3, "usesHp": True,  "typical_watts": 1500},
    {"name": "Refrigerator",      "category": "Inductive", "multiplier": 3, "usesHp": False, "typical_watts": 150},
    {"name": "Washing Machine",   "category": "Inductive", "multiplier": 3, "usesHp": False, "typical_watts": 500},
    {"name": "Ceiling Fan",       "category": "Inductive", "multiplier": 3, "usesHp": False, "typical_watts": 75},
    {"name": "Exhaust Fan",       "category": "Inductive", "multiplier": 3, "usesHp": False, "typical_watts": 60},
    {"name": "Vacuum Cleaner",    "category": "Inductive", "multiplier": 3, "usesHp": False, "typical_watts": 800},
    {"name": "Dishwasher",        "category": "Inductive", "multiplier": 3, "usesHp": False, "typical_watts": 1200},
    {"name": "Water Pump",        "category": "Inductive", "multiplier": 3, "usesHp": True,  "typical_watts": None},  # too variable — see NEVER_ESTIMATE below
    {"name": "Inverter AC",       "category": "Inductive", "multiplier": 3, "usesHp": True,  "typical_watts": 1200},
    {"name": "Hair Dryer",        "category": "Inductive", "multiplier": 3, "usesHp": False, "typical_watts": 1200},
    {"name": "Electric Heater",   "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 1500},
    {"name": "Electric Kettle",   "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 1500},
    {"name": "Toaster",           "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 800},
    {"name": "Electric Stove",    "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 2000},
    {"name": "Electric Oven",     "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 2000},
    {"name": "Incandescent Bulb", "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 60},
    {"name": "Iron (Electric)",   "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 1000},
    {"name": "Microwave Oven",    "category": "Resistive", "multiplier": 4, "usesHp": False, "typical_watts": 1200},
    {"name": "LED Light",         "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 15},
    {"name": "CFL Light",         "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 20},
    {"name": "LED TV",            "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 120},
    {"name": "Computer",          "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 200},
    {"name": "Laptop",            "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 65},
    {"name": "Phone Charger",     "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 10},
    {"name": "Scanner",           "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 35},
    {"name": "Printer",           "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 150},
    {"name": "Photocopy Machine", "category": "Nonlinear", "multiplier": 1, "usesHp": False, "typical_watts": 1200},
]
CATALOG_BY_NAME = {a["name"]: a for a in APPLIANCE_CATALOG}
CATEGORY_MULTIPLIERS = {"Inductive": 3, "Resistive": 4, "Nonlinear": 1}
 
# Types whose real running wattage varies too widely to default from a catalog
# figure at all — these must always come from an explicit stated spec or be
# flagged NEEDS_INPUT, never silently filled from "typical_watts".
NEVER_DEFAULT = {"Water Pump"}
 
# Conversion constants — same role as HP_TO_WATT already in your frontend.
# Keep these as named, editable values; different jobs will disagree with them.
AMP_TO_WATT_VOLTAGE = 240   # single-phase 220-240V mains, unity power factor assumed
AC_EER_ASSUMED = 10         # for BTU-rated units with no amps/watts given
 
AMP_RE = re.compile(r'(\d+(?:\.\d+)?)\s*a(?:mp)?s?\b', re.IGNORECASE)
BTU_RE = re.compile(r'(\d+(?:\.\d+)?)\s*btu\b', re.IGNORECASE)
# See note above the earlier load_parser.py: "ph" is ambiguous (phase vs a typo
# for "hp") and must never be silently resolved either way.
PH_AMBIGUOUS_RE = re.compile(r'\b(\d+(?:\.\d+)?)\s*ph\b(?!ase)', re.IGNORECASE)
 
 
# ---------------------------------------------------------------------------
# 2. MODEL — extend ParsedAppliance with the new fields. `source` is what the
#    frontend uses to render the confidence badge; `flagged_outlier` and
#    `ambiguous` drive the two new UI states in ParsedPreview.jsx.
# ---------------------------------------------------------------------------
class ParsedAppliance(BaseModel):
    name: str
    category: str
    multiplier: int
    wattage: Optional[float] = None
    horsepower: Optional[float] = None
    amperage: Optional[float] = None                       # NEW
    quantity: int = Field(1, ge=1)
    uses_hp: bool = False
    uses_amp: bool = False                                  # NEW
    matched: bool = False
    source: str = "llm"                                     # NEW: exact|amp|hp|btu|catalog|llm|needs_input|ambiguous
    flagged_outlier: bool = False                            # NEW
    outlier_note: Optional[str] = None                       # NEW
    ambiguous: bool = False                                  # NEW
    confirm_options: Optional[list] = None                   # NEW — populated only when ambiguous=True
 
 
# ---------------------------------------------------------------------------
# 3. PROMPT — the only behavioral change: explicitly forbid the LLM from
#    doing amp/hp/btu -> watt arithmetic, and forbid it from inventing a
#    wattage for a catalog match when the text gives no number. It should
#    report raw numbers only.
# ---------------------------------------------------------------------------
def _build_parse_prompt(user_text: str) -> str:
    catalog_lines = "\n".join(
        f"- {a['name']} | category={a['category']} | multiplier={a['multiplier']} | usesHp={str(a['usesHp']).lower()}"
        for a in APPLIANCE_CATALOG
    )
    return (
        "You are an assistant that extracts a list of electrical appliances from "
        "free text (typed lists, transcribed speech, or text extracted from a PDF). "
        "For each distinct appliance the user mentions, return one entry. "
        "Match each appliance to the known catalog below when possible; for a match "
        "use the EXACT catalog name, category, and multiplier. For an appliance not "
        "in the catalog, infer its category (Inductive for motors/compressors, "
        "Resistive for heating elements, Nonlinear for electronics), set matched=false, "
        "and give multiplier from the category (Inductive=3, Resistive=4, Nonlinear=1).\n\n"
        "Known catalog (name | category | multiplier | usesHp):\n"
        f"{catalog_lines}\n\n"
        "CRITICAL — do not do unit conversion or invent numbers:\n"
        "- Report ONLY the number(s) actually present in the text, in their original "
        "unit. If the text says '1500W', set wattage=1500. If it says '1.5HP', set "
        "horsepower=1.5 and leave wattage null. If it says '1.2amp' or '1.2A', set "
        "amperage=1.2 and leave wattage AND horsepower null. NEVER convert amps or HP "
        "to watts yourself — that conversion happens outside this step.\n"
        "- If the text gives NO number for an appliance at all (no W, A, or HP), leave "
        "wattage, horsepower, and amperage all null. Do NOT guess a typical wattage — "
        "even for a catalog match. A downstream step fills in catalog defaults; your "
        "job is only to report what the text actually states.\n"
        "- Skip any line that only describes an electrical PHASE (e.g. '2 phase', "
        "'3-phase') with no separate quantity/rating of its own — do not treat the "
        "phase count as a quantity or as horsepower.\n\n"
        "quantity: number of units (default 1). 'two fans', '3x fridge', 'Qty 3' all "
        "mean quantity 3. A number immediately followed by 'HP' or 'A'/'amp' is a "
        "rating, NOT a quantity.\n\n"
        "Return ONLY a valid JSON object, no extra text, no markdown fences:\n"
        "{\n"
        '  "appliances": [\n'
        '    {"name":"Ceiling Fan","category":"Inductive","multiplier":3,'
        '"wattage":75,"horsepower":null,"amperage":null,"quantity":3,'
        '"uses_hp":false,"matched":true}\n'
        "  ]\n"
        "}\n\n"
        f"User text:\n{user_text}"
    )
 
 
# ---------------------------------------------------------------------------
# 4. DETERMINISTIC PRE-PASS — pull out lines matching the ambiguous "ph"
#    pattern BEFORE they ever reach the LLM. This is fully deterministic and
#    doesn't rely on the model noticing or reporting the ambiguity itself.
# ---------------------------------------------------------------------------
def _extract_ambiguous_ph_lines(user_text: str) -> tuple[str, list[dict]]:
    """Returns (remaining_text_for_llm, list_of_ambiguous_appliance_dicts)."""
    kept_lines = []
    ambiguous_items = []
 
    for line in user_text.splitlines():
        m = PH_AMBIGUOUS_RE.search(line)
        if not m:
            kept_lines.append(line)
            continue
 
        value = float(m.group(1))
        name = re.sub(PH_AMBIGUOUS_RE, "", line).strip(" -—:")
        name = re.sub(r'^\d+\s*(units?\s*)?(of\s+)?', '', name, flags=re.IGNORECASE).strip()
 
        hp_watts = value * 746
        ambiguous_items.append({
            "name": name or line.strip(),
            "category": "Inductive",
            "multiplier": 3,
            "wattage": None,
            "horsepower": None,
            "amperage": None,
            "quantity": 1,
            "uses_hp": False,
            "uses_amp": False,
            "matched": False,
            "source": "ambiguous",
            "flagged_outlier": False,
            "outlier_note": None,
            "ambiguous": True,
            "confirm_options": [
                {"choice": "hp", "label": f"{value:g} HP", "watts": round(hp_watts)},
                {"choice": "phase", "label": f"{int(value)}-phase supply", "watts": None},
            ],
        })
        # don't forward this line to the LLM — it's fully handled here
 
    return "\n".join(kept_lines), ambiguous_items
 
 
# ---------------------------------------------------------------------------
# 5. DETERMINISTIC POST-PASS — apply conversions, catalog defaults, and the
#    outlier sanity check to whatever the LLM returned. This is where amp/hp/
#    btu arithmetic actually happens, not inside the model.
# ---------------------------------------------------------------------------
def _resolve_appliance(a: dict, raw_line_hint: str = "") -> dict:
    catalog_entry = CATALOG_BY_NAME.get(a["name"])
 
    # explicit amperage reported by the LLM -> deterministic conversion
    if a.get("amperage") is not None:
        a["wattage"] = a["amperage"] * AMP_TO_WATT_VOLTAGE
        a["source"] = "amp"
        a["uses_amp"] = True
 
    # explicit horsepower -> deterministic conversion (matches your existing
    # frontend constant of 746; keep this the single source of truth and have
    # the frontend read it from the API response rather than hardcoding twice)
    elif a.get("horsepower") is not None:
        a["wattage"] = a["horsepower"] * 746
        a["source"] = "hp"
        a["uses_hp"] = True
 
    # explicit wattage stated in text
    elif a.get("wattage") is not None:
        a["source"] = "exact"
 
    # nothing stated -> catalog default, if this appliance type allows one
    elif catalog_entry and catalog_entry["name"] not in NEVER_DEFAULT and catalog_entry["typical_watts"]:
        a["wattage"] = catalog_entry["typical_watts"]
        a["source"] = "catalog"
 
    else:
        a["wattage"] = None
        a["source"] = "needs_input"
 
    # outlier sanity check — only meaningful for catalog matches with an
    # explicitly stated (not defaulted) wattage
    if catalog_entry and catalog_entry.get("typical_watts") and a["source"] in ("exact", "amp"):
        typical = catalog_entry["typical_watts"]
        if a["wattage"] > typical * 6 or a["wattage"] < typical * 0.15:
            a["flagged_outlier"] = True
            a["outlier_note"] = (
                f"{a['wattage']:.0f}W is unusual for a {a['name']} "
                f"(typical ~{typical}W) — verify against the nameplate"
            )
 
    return a
 
 
def _parse_appliances_from_text(user_text: str) -> list[dict]:
    if not user_text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
 
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured on the server")
 
    # NEW: strip ambiguous lines out before the LLM ever sees them
    llm_text, ambiguous_items = _extract_ambiguous_ph_lines(user_text)
 
    normalised = list(ambiguous_items)  # ambiguous items need no LLM call at all
 
    if llm_text.strip():
        client = Groq(api_key=api_key)
        prompt = _build_parse_prompt(llm_text)
        try:
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_completion_tokens=1500,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Groq API error: {exc}") from exc
 
        raw = response.choices[0].message.content.strip()
        cleaned = _clean_llm_json(raw)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            brace = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
            data = json.loads(brace.group(0)) if brace else None
 
        if not isinstance(data, dict) or "appliances" not in data:
            raise HTTPException(status_code=502, detail=f"Could not parse a JSON response from Groq. Raw: {raw[:500]}")
 
        for a in (data.get("appliances") or []):
            if not isinstance(a, dict) or not a.get("name"):
                continue
            category = str(a.get("category", "Nonlinear")).title()
            if category not in CATEGORY_MULTIPLIERS:
                category = "Nonlinear"
            multiplier = a.get("multiplier")
            if not isinstance(multiplier, int) or multiplier not in (1, 3, 4):
                multiplier = CATEGORY_MULTIPLIERS[category]
            try:
                qty = max(1, int(a.get("quantity", 1)))
            except (TypeError, ValueError):
                qty = 1
 
            def _num(v):
                try:
                    return float(v) if v is not None else None
                except (TypeError, ValueError):
                    return None
 
            entry = {
                "name": str(a["name"]),
                "category": category,
                "multiplier": multiplier,
                "wattage": _num(a.get("wattage")),
                "horsepower": _num(a.get("horsepower")),
                "amperage": _num(a.get("amperage")),
                "quantity": qty,
                "uses_hp": bool(a.get("uses_hp", False)),
                "uses_amp": False,
                "matched": bool(a.get("matched", False)),
                "source": "llm",
                "flagged_outlier": False,
                "outlier_note": None,
                "ambiguous": False,
                "confirm_options": None,
            }
            normalised.append(_resolve_appliance(entry))
 
    return normalised
 
 
@app.post("/parse-text", response_model=ParseTextResponse, tags=["Appliance Parsing"])
async def parse_text(request: ParseTextRequest) -> ParseTextResponse:
    appliances = _parse_appliances_from_text(request.text)
    return ParseTextResponse(appliances=[ParsedAppliance(**a) for a in appliances])


# ---------------------------------------------------------------------------
# Voice transcription (Groq Whisper)
# ---------------------------------------------------------------------------

GROQ_AUDIO_MODEL = "whisper-large-v3"
ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/ogg",
}


class TranscriptionResponse(BaseModel):
    """Transcribed text from an audio recording."""

    text: str = Field(..., description="Transcribed text from the audio")


@app.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    tags=["Voice"],
    summary="Transcribe an audio recording to text",
    description=(
        "Accepts an audio file (recorded in-browser via MediaRecorder) and "
        "returns the transcribed text using Groq's Whisper model. The frontend "
        "then sends that text to /parse-text to extract appliances."
    ),
)
async def transcribe(file: UploadFile = File(...)) -> TranscriptionResponse:
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        # MediaRecorder on Chrome defaults to audio/webm; be lenient if the
        # declared type is missing or unusual.
        if not file.content_type or not file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{file.content_type}'. Allowed: {sorted(ALLOWED_AUDIO_TYPES)}",
            )

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio is empty")

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured on the server",
        )

    client = Groq(api_key=api_key)
    filename = file.filename or "recording.webm"

    try:
        # Groq's transcription endpoint takes a file-like object + filename.
        response = client.audio.transcriptions.create(
            model=GROQ_AUDIO_MODEL,
            file=(filename, audio_bytes),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq API error: {exc}") from exc

    return TranscriptionResponse(text=response.text)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
