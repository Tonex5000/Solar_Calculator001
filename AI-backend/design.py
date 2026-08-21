"""
Composition layer: turns calculate_system's engineering targets into real,
priced products from the Supabase catalog.


SCHEMA STATUS:
- Solar Panels: confirmed schema, power is numeric and reliable. Panel
  matching below is fully functional.
- Batteries / Inverters: NOT confirmed. We don't know whether their rating
  (Ah, kVA) lives in the `power` column like panels, or in `capacity`/
  `rating` as unparsed free text like panels' voltage/current do. Rather
  than guess, matching for these categories raises a clear
  SchemaNotConfirmedError instead of silently matching on a field that
  might mean the wrong thing. Fill in CATEGORY_NAMES and the two stub
  functions once sample rows are available — see README.
"""


import math


import supabase_client as db


# Real Solar Panels category name confirmed from data. The rest are best
# guesses at naming convention (Title Case, plural) — CONFIRM before relying
# on them; get_categories() will tell you the real values.
CATEGORY_NAMES = {
    "panel": "Solar Panels",
    "battery": "Batteries",  # UNCONFIRMED
    "inverter": "Inverters",  # UNCONFIRMED
}




class SchemaNotConfirmedError(Exception):
    """Raised when a match would require guessing at an unconfirmed column meaning."""




def select_best_value_panel(min_power_floor: float = 300) -> dict | None:
    """
    Best $/W panel meeting a minimum wattage floor — matches real installer
    practice (lowest cost per watt) rather than picking the cheapest panel
    regardless of size, or the one closest to some arbitrary target.
    """
    candidates = db.search_products(
        category=CATEGORY_NAMES["panel"], min_power=min_power_floor, limit=100
    )
    if not candidates:
        return None
    priced = [c for c in candidates if c.get("power") and c.get("price")]
    if not priced:
        return None
    best = min(priced, key=lambda p: p["price"] / p["power"])
    return best




def match_panels_to_target(total_watts_needed: float, min_power_floor: float = 300) -> dict:
    """
    Picks the best-value panel and computes how many are needed to reach
    total_watts_needed. Returns the chosen product, count, and total cost.
    """
    panel = select_best_value_panel(min_power_floor)
    if panel is None:
        return {"found": False, "reason": "No panels in catalog meeting the wattage floor."}
    count = math.ceil(total_watts_needed / panel["power"])
    return {
        "found": True,
        "product": panel,
        "count": count,
        "total_watts": count * panel["power"],
        "total_cost": count * panel["price"],
        "price_checked_at": panel.get("price_checked_at"),
    }




def match_battery_to_target(required_ah: float, voltage: float) -> dict:
    """
    STUBBED — do not call in production yet. Battery Ah rating's real
    column is unconfirmed (could be `power`, `capacity`, or something else
    entirely — capacity is free text like "220Ah" in the panels data, which
    would need parsing, not filtering). Raises rather than guessing.
    """
    raise SchemaNotConfirmedError(
        "Battery catalog matching needs a confirmed schema (sample battery row) "
        "before this can safely filter on the right column. See README."
    )




def match_inverter_to_target(min_kva: float) -> dict:
    """STUBBED — same reason as match_battery_to_target, for inverters."""
    raise SchemaNotConfirmedError(
        "Inverter catalog matching needs a confirmed schema (sample inverter row) "
        "before this can safely filter on the right column. See README."
    )




def match_design_to_catalog(system_requirements: dict) -> dict:
    """
    Takes calculate_system's engineering targets and returns real,
    purchasable products for each component. Panels are fully functional;
    battery/inverter matching will raise SchemaNotConfirmedError until
    their schema is confirmed — this is caught here and surfaced as a
    partial result, not a crash, so panel matching still returns usable
    output today.


    Expected keys in system_requirements:
        panel_watts_needed: float
        panel_min_power_floor: float (optional, default 300)
        battery_ah_needed: float (optional)
        battery_voltage: float (optional)
        inverter_min_kva: float (optional)
    """
    result: dict = {"components": {}, "warnings": [], "total_cost": 0}


    if "panel_watts_needed" in system_requirements:
        panels = match_panels_to_target(
            system_requirements["panel_watts_needed"],
            system_requirements.get("panel_min_power_floor", 300),
        )
        result["components"]["panels"] = panels
        if panels.get("found"):
            result["total_cost"] += panels["total_cost"]


    if "battery_ah_needed" in system_requirements:
        try:
            battery = match_battery_to_target(
                system_requirements["battery_ah_needed"],
                system_requirements.get("battery_voltage", 12),
            )
            result["components"]["battery"] = battery
            result["total_cost"] += battery.get("total_cost", 0)
        except SchemaNotConfirmedError as e:
            result["components"]["battery"] = {"found": False, "reason": str(e)}
            result["warnings"].append(str(e))


    if "inverter_min_kva" in system_requirements:
        try:
            inverter = match_inverter_to_target(system_requirements["inverter_min_kva"])
            result["components"]["inverter"] = inverter
            result["total_cost"] += inverter.get("total_cost", 0)
        except SchemaNotConfirmedError as e:
            result["components"]["inverter"] = {"found": False, "reason": str(e)}
            result["warnings"].append(str(e))


    result["complete"] = len(result["warnings"]) == 0
    return result




def solve_budget_design(
    budget: float,
    panel_watts_needed: float,
    battery_ah_needed: float | None = None,
    battery_voltage: float = 12,
    inverter_min_kva: float | None = None,
) -> dict:
    """
    Budget-first design: given a fixed budget, returns the best system that
    fits, with explicit trade-offs if the full target can't be reached.


    CURRENT LIMITATION: fully functional for the panel portion only —
    battery/inverter budget trade-offs can't be computed until their
    catalog matching is unblocked (see match_design_to_catalog). This
    still returns a real, useful partial answer for panels rather than
    refusing outright, but the overall budget picture is incomplete until
    the schema question is resolved.
    """
    design = match_design_to_catalog({
        "panel_watts_needed": panel_watts_needed,
        "battery_ah_needed": battery_ah_needed,
        "battery_voltage": battery_voltage,
        "inverter_min_kva": inverter_min_kva,
    })


    if design["total_cost"] <= budget:
        fits = True
        shortfall = 0
    else:
        fits = False
        shortfall = design["total_cost"] - budget


    return {
        "budget": budget,
        "design": design,
        "fits_budget": fits,
        "shortfall": shortfall,
        "note": (
            "This reflects panel pricing only until battery/inverter catalog "
            "matching is unblocked — treat total_cost as a partial figure, "
            "not the full system cost."
            if design["warnings"] else None
        ),
    }
