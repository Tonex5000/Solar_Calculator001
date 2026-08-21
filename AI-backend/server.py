"""
MCP server exposing Voltra's Supabase solar-product database as read-only
tools. Run standalone for local testing:


    python server.py


Or point agent/langchain_agent.py at this file via stdio transport.


Schema confirmed against a real data export — see SCHEMA_ASSUMPTIONS.md.
Numeric filtering (min_power) is validated for the "Solar Panels" category
only; other categories' filterable fields are not yet confirmed.


Every tool here is read-only. No add/update/delete tool exists in this
server on purpose — use a read-only Supabase key regardless of the
code-level guarantee.
"""


import supabase_client as db
import design
import Engineering
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP


load_dotenv()


mcp = FastMCP("voltra-product-db")




@mcp.tool()
def search_products(
    category: str | None = None,
    subcategory: str | None = None,
    manufacturer: str | None = None,
    min_power: float | None = None,
    max_price: float | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    Search the solar component catalog.


    Args:
        category: exact match, e.g. "Solar Panels". Omit to search all.
        subcategory: exact match, e.g. "Bifacial", "Monocrystalline",
            "Monofacial". Only meaningful within Solar Panels so far.
        manufacturer: partial, case-insensitive match, e.g. "Jinko".
        min_power: minimum wattage (numeric). Confirmed reliable for Solar
            Panels; unconfirmed for other categories.
        max_price: upper bound on price (NGN).
        limit: max results, default 20.


    Returns a price-ascending list of matching products.
    """
    return db.search_products(category, subcategory, manufacturer, min_power, max_price, limit)




@mcp.tool()
def get_product(product_id: str) -> dict | None:
    """Full detail on one exact product by its ID (e.g. "NSP-0001")."""
    return db.get_product(product_id)




@mcp.tool()
def get_categories() -> list[str]:
    """List every distinct product category currently in the catalog."""
    return db.get_categories()




@mcp.tool()
def get_cheapest_match(category: str, min_power: float) -> dict | None:
    """
    Find the cheapest product in a category rated at least min_power watts.
    e.g. get_cheapest_match("Solar Panels", 500). Only validated for Solar
    Panels — other categories' power semantics are unconfirmed.
    """
    return db.get_cheapest_match(category, min_power)




@mcp.tool()
def get_price_range(category: str) -> dict:
    """
    Min/max/avg/median price for a category — a fast feasibility check
    before recommending a full system design.
    """
    return db.get_price_range(category)




@mcp.tool()
def compare_products(product_ids: list[str]) -> list[dict]:
    """Side-by-side spec and price detail for a set of specific products."""
    return db.compare_products(product_ids)




@mcp.tool()
def get_supplier_info(product_id: str) -> dict | None:
    """Seller name and source listing URL for a specific product."""
    return db.get_supplier_info(product_id)




@mcp.tool()
def check_stock_availability(product_id: str) -> dict:
    """
    Best-effort stock status ("in_stock" / "out_of_stock" / "unknown"),
    inferred from free-text notes. "unknown" means no stock language was
    found — treat it as "not confirmed," not as "available."
    """
    return db.check_stock_availability(product_id)




@mcp.tool()
def get_last_updated(product_id: str | None = None, category: str | None = None) -> dict:
    """
    Report how stale a price is, in days, based on price_checked_at.
    Pass exactly one of product_id or category.
    """
    return db.get_last_updated(product_id, category)




@mcp.tool()
def match_design_to_catalog(
    panel_watts_needed: float | None = None,
    panel_min_power_floor: float = 300,
    battery_ah_needed: float | None = None,
    battery_voltage: float = 12,
    inverter_min_kva: float | None = None,
) -> dict:
    """
    Turn Engineering sizing targets (from calculate_system) into real,
    priced products from the catalog. Panel matching is fully functional.
    Battery and inverter matching will report a warning instead of a
    result until their catalog schema is confirmed — this still returns
    real panel data rather than failing outright.
    """
    reqs = {}
    if panel_watts_needed is not None:
        reqs["panel_watts_needed"] = panel_watts_needed
        reqs["panel_min_power_floor"] = panel_min_power_floor
    if battery_ah_needed is not None:
        reqs["battery_ah_needed"] = battery_ah_needed
        reqs["battery_voltage"] = battery_voltage
    if inverter_min_kva is not None:
        reqs["inverter_min_kva"] = inverter_min_kva
    return design.match_design_to_catalog(reqs)




@mcp.tool()
def solve_budget_design(
    budget: float,
    panel_watts_needed: float,
    battery_ah_needed: float | None = None,
    battery_voltage: float = 12,
    inverter_min_kva: float | None = None,
) -> dict:
    """
    Budget-first design — best system a fixed budget can buy, with the
    shortfall made explicit if it can't cover everything requested.
    Currently reflects panel pricing only; see match_design_to_catalog for
    why battery/inverter portions are incomplete.
    """
    return design.solve_budget_design(
        budget, panel_watts_needed, battery_ah_needed, battery_voltage, inverter_min_kva
    )




@mcp.tool()
def size_cable(
    current_amps: float,
    one_way_length_m: float,
    system_voltage: float,
    max_voltage_drop_pct: float = 3.0,
    material: str = "copper",
) -> dict:
    """
    Minimum cable size for a DC run, based on voltage-drop physics (real,
    trustworthy). Ampacity safety check will report
    "insufficient_reference_data" until AMPACITY_TABLE in Engineering.py is
    populated — never treat a returned size as safety-verified until that
    status reads "ok".
    """
    result = Engineering.size_cable(current_amps, one_way_length_m, system_voltage, max_voltage_drop_pct, material)
    return {
        "required_area_mm2": result.required_area_mm2,
        "recommended_size_mm2": result.recommended_size_mm2,
        "actual_voltage_drop_pct": result.actual_voltage_drop_pct,
        "ampacity_status": result.ampacity_status,
        "material": result.material,
        "notes": result.notes,
    }




@mcp.tool()
def check_system_safety(design_spec: dict) -> dict:
    """
    Runs available safety checks (breaker sizing, cable ampacity, inverter
    headroom) against a proposed design. Each check reports pass/fail/
    insufficient_data independently — the overall result is never "pass"
    unless every check that could run actually passed, and is "incomplete"
    rather than "pass" if reference data (e.g. ampacity table) is missing.
    """
    return Engineering.check_system_safety(design_spec)




if __name__ == "__main__":
    mcp.run()
