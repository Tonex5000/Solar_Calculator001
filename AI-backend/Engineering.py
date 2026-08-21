"""
Deterministic electrical engineering calculations — cable sizing and system
safety checks. No LLM involvement in any of this module; every number here
is either a physics constant or an explicit reference table.


STATUS OF EACH CALCULATION:
- Voltage drop: real physics (resistivity-based), safe to trust as-is.
- Standard cable sizes: real IEC metric sizes, safe to trust as-is.
- Ampacity (max safe current per cable size): AMPACITY_TABLE below is
  EMPTY. Populate it before trusting ampacity_ok in any output — until
  then, every result explicitly reports "insufficient_reference_data"
  rather than a fabricated pass/fail.
- Breaker continuous-load factor (125%): a widely used rule of thumb
  (mirrors NEC 210.19 continuous-load practice), not Nigeria-specific code.
  Treat as a sanity check, not a substitute for actual applicable code.
"""


from dataclasses import dataclass, field


# Ω·mm²/m at 20°C — standard published resistivity values, temperature-
# dependent (real cable runs in hot installation environments will have
# measurably higher resistance than this; treat results as a conservative
# starting point, not a final spec).
RESISTIVITY = {
    "copper": 0.0175,
    "aluminum": 0.0282,
}


# Standard IEC metric cable cross-sections (mm²) — real manufactured sizes.
STANDARD_CABLE_SIZES_MM2 = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240]


# --- REFERENCE DATA NEEDED — see REFERENCE_DATA_NEEDED.md ---
# Fill this in as: {"copper": {1.5: max_amps, 2.5: max_amps, ...}, "aluminum": {...}}
# Values should be continuous-current ampacity for the installation method
# you actually use (e.g. conduit vs free air), since these differ.
AMPACITY_TABLE: dict[str, dict[float, float]] = {}


BREAKER_CONTINUOUS_FACTOR = 1.25  # rule-of-thumb, not a substitute for local code




@dataclass
class CableSizingResult:
    required_area_mm2: float
    recommended_size_mm2: float | None
    actual_voltage_drop_pct: float | None
    ampacity_status: str  # "ok" | "insufficient" | "insufficient_reference_data"
    material: str
    notes: list[str] = field(default_factory=list)




def size_cable(
    current_amps: float,
    one_way_length_m: float,
    system_voltage: float,
    max_voltage_drop_pct: float = 3.0,
    material: str = "copper",
) -> CableSizingResult:
    """
    Minimum cable cross-section to keep DC voltage drop under a limit, plus
    an ampacity check if AMPACITY_TABLE has been populated for this
    material.


    Voltage drop formula (real, not fabricated):
        Vdrop = (2 x L x I x resistivity) / area
    The factor of 2 accounts for the round trip (out and back) of a DC
    circuit. Round up to the nearest standard manufactured size.
    """
    notes = []
    if material not in RESISTIVITY:
        raise ValueError(f"Unknown material '{material}' — expected one of {list(RESISTIVITY)}")


    resistivity = RESISTIVITY[material]
    required_area = (2 * one_way_length_m * current_amps * resistivity) / (
        system_voltage * max_voltage_drop_pct / 100
    )


    recommended = next((s for s in STANDARD_CABLE_SIZES_MM2 if s >= required_area), None)
    if recommended is None:
        notes.append(
            f"Required area ({required_area:.2f} mm²) exceeds the largest standard size "
            f"in STANDARD_CABLE_SIZES_MM2 ({STANDARD_CABLE_SIZES_MM2[-1]} mm²). "
            "Long runs or high current may need parallel conductors — not handled by this function."
        )
        actual_drop = None
    else:
        actual_drop = (2 * one_way_length_m * current_amps * resistivity) / recommended / system_voltage * 100


    if not AMPACITY_TABLE.get(material):
        ampacity_status = "insufficient_reference_data"
        notes.append(
            f"AMPACITY_TABLE has no entries for '{material}' — ampacity NOT checked. "
            "See REFERENCE_DATA_NEEDED.md. Do not treat this cable size as safety-verified."
        )
    elif recommended is not None and recommended in AMPACITY_TABLE[material]:
        max_amps = AMPACITY_TABLE[material][recommended]
        ampacity_status = "ok" if current_amps <= max_amps else "insufficient"
        if ampacity_status == "insufficient":
            notes.append(
                f"{recommended} mm² {material} is rated for {max_amps}A continuous in your "
                f"reference table, but this circuit carries {current_amps}A — size up."
            )
    else:
        ampacity_status = "insufficient_reference_data"
        notes.append(f"No ampacity entry for {recommended} mm² {material} — add it to AMPACITY_TABLE.")


    return CableSizingResult(
        required_area_mm2=round(required_area, 3),
        recommended_size_mm2=recommended,
        actual_voltage_drop_pct=round(actual_drop, 3) if actual_drop is not None else None,
        ampacity_status=ampacity_status,
        material=material,
        notes=notes,
    )




def check_system_safety(design: dict) -> dict:
    """
    Runs available safety checks against a proposed design. Each check
    independently reports pass / fail / insufficient_data — a design is
    never silently marked "safe" if a check couldn't actually run.


    Expected keys in `design` (all optional — checks run on whatever's
    present):
        breaker_rated_amps: float
        continuous_load_amps: float
        cable: {current_amps, one_way_length_m, system_voltage, material}
        inverter_kva: float
        expected_load_kva: float
    """
    checks = []


    if "breaker_rated_amps" in design and "continuous_load_amps" in design:
        required_min = design["continuous_load_amps"] * BREAKER_CONTINUOUS_FACTOR
        passed = design["breaker_rated_amps"] >= required_min
        checks.append({
            "check": "breaker_continuous_load",
            "status": "pass" if passed else "fail",
            "detail": (
                f"Breaker rated {design['breaker_rated_amps']}A; "
                f"continuous load {design['continuous_load_amps']}A needs >= {required_min:.1f}A "
                f"at a {BREAKER_CONTINUOUS_FACTOR}x factor (rule of thumb, verify against local code)."
            ),
        })
    else:
        checks.append({"check": "breaker_continuous_load", "status": "insufficient_data"})


    if "cable" in design:
        c = design["cable"]
        result = size_cable(
            c["current_amps"], c["one_way_length_m"], c["system_voltage"],
            c.get("max_voltage_drop_pct", 3.0), c.get("material", "copper"),
        )
        checks.append({
            "check": "cable_sizing",
            "status": "pass" if result.ampacity_status == "ok" else result.ampacity_status,
            "detail": result.notes,
            "recommended_size_mm2": result.recommended_size_mm2,
        })
    else:
        checks.append({"check": "cable_sizing", "status": "insufficient_data"})


    if "inverter_kva" in design and "expected_load_kva" in design:
        # calculate_system already applies a x2 surge factor when sizing the
        # inverter target in the first place — this just confirms the
        # *chosen* product still clears the expected load with headroom,
        # in case a cheaper/smaller unit got substituted downstream.
        passed = design["inverter_kva"] >= design["expected_load_kva"] * 1.2
        checks.append({
            "check": "inverter_headroom",
            "status": "pass" if passed else "fail",
            "detail": f"Inverter {design['inverter_kva']}kVA vs load {design['expected_load_kva']}kVA.",
        })
    else:
        checks.append({"check": "inverter_headroom", "status": "insufficient_data"})


    statuses = [c["status"] for c in checks]
    if "fail" in statuses:
        overall = "needs_review"
    elif "insufficient_data" in statuses or "insufficient_reference_data" in statuses:
        overall = "incomplete"
    else:
        overall = "pass"


    return {"overall": overall, "checks": checks}
