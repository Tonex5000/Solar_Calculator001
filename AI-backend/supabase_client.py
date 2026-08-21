"""
Thin, read-only wrapper around the Supabase `products` table.


Schema confirmed against a real data export (Solar Panels category) — see
SCHEMA_ASSUMPTIONS.md. Columns are flat, NOT jsonb — there is no `specs`
column. `power` is the only numeric spec field confirmed reliable for
filtering; `rating`/`voltage`/`current`/`capacity` are free-text strings
with units baked in and are returned as-is, never parsed.


Whether other categories (battery, inverter, etc.) use `power` for the same
meaning, or need different filter columns entirely, is NOT yet confirmed —
see README. Until that's resolved, treat numeric filtering as validated for
Solar Panels only.


SECURITY: the SUPABASE_KEY used by this module should be a read-only key
(Postgres role restricted to SELECT, or an RLS policy that denies
INSERT/UPDATE/DELETE for this key). This module contains no write
operations by design, but that's a code-level guarantee, not a database-
level one — enforce it at the credential/RLS level too.
"""


import os
import statistics
from datetime import date, datetime
from typing import Any


from supabase import create_client, Client


TABLE_NAME = "products"


COLUMNS = {
    "id": "id",
    "category": "category",
    "subcategory": "subcategory",
    "manufacturer": "manufacturer",
    "model": "model",
    "rating": "rating",
    "power": "power",
    "voltage": "voltage",
    "current": "current",
    "capacity": "capacity",
    "technology": "technology",
    "specifications": "specifications",
    "price": "price",
    "currency": "currency",
    "unit": "unit",
    "seller": "seller",
    "source_url": "source_url",
    "price_checked_at": "price_checked_at",
    "notes": "notes",
}


_client: Client | None = None




def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set (see .env.example). "
                "Use a read-only key — see the module docstring."
            )
        _client = create_client(url, key)
    return _client




def _select_all_columns() -> str:
    return ", ".join(COLUMNS.values())




def search_products(
    category: str | None = None,
    subcategory: str | None = None,
    manufacturer: str | None = None,
    min_power: float | None = None,
    max_price: float | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    General product search.


    category/subcategory: exact match against the Title-Case values stored
        in the DB, e.g. category="Solar Panels", subcategory="Bifacial".
    manufacturer: partial, case-insensitive match.
    min_power: minimum wattage — filters on the numeric `power` column.
        Only confirmed meaningful for Solar Panels so far; passing this for
        other categories may silently return nothing if their `power`
        column means something different or is unused. See
        SCHEMA_ASSUMPTIONS.md.
    max_price: upper bound on price (NGN).
    """
    q = get_client().table(TABLE_NAME).select(_select_all_columns())
    if category:
        q = q.eq(COLUMNS["category"], category)
    if subcategory:
        q = q.eq(COLUMNS["subcategory"], subcategory)
    if manufacturer:
        q = q.ilike(COLUMNS["manufacturer"], f"%{manufacturer}%")
    if min_power is not None:
        q = q.gte(COLUMNS["power"], min_power)
    if max_price is not None:
        q = q.lte(COLUMNS["price"], max_price)
    q = q.order(COLUMNS["price"], desc=False).limit(limit)
    res = q.execute()
    return res.data or []




def get_product(product_id: str) -> dict | None:
    res = (
        get_client()
        .table(TABLE_NAME)
        .select(_select_all_columns())
        .eq(COLUMNS["id"], product_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None




def get_categories() -> list[str]:
    res = get_client().table(TABLE_NAME).select(COLUMNS["category"]).execute()
    rows = res.data or []
    seen = []
    for r in rows:
        c = r.get(COLUMNS["category"])
        if c and c not in seen:
            seen.append(c)
    return sorted(seen)




def get_cheapest_match(category: str, min_power: float) -> dict | None:
    """
    Cheapest product in `category` with power >= min_power.
    e.g. get_cheapest_match("Solar Panels", 500) for a panel rated at
    least 500W. Only validated for Solar Panels — see module docstring.
    """
    q = (
        get_client()
        .table(TABLE_NAME)
        .select(_select_all_columns())
        .eq(COLUMNS["category"], category)
        .gte(COLUMNS["power"], min_power)
        .order(COLUMNS["price"], desc=False)
        .limit(1)
    )
    res = q.execute()
    rows = res.data or []
    return rows[0] if rows else None




def get_price_range(category: str) -> dict:
    """
    Min/max/avg/median price for a category. Fetches only the price column
    and computes stats client-side — fine for catalog-sized data. For a
    very large catalog, replace with a Postgres view/RPC instead.
    """
    res = (
        get_client()
        .table(TABLE_NAME)
        .select(COLUMNS["price"])
        .eq(COLUMNS["category"], category)
        .execute()
    )
    prices = [r[COLUMNS["price"]] for r in (res.data or []) if r.get(COLUMNS["price"]) is not None]
    if not prices:
        return {"category": category, "count": 0}
    return {
        "category": category,
        "count": len(prices),
        "min_price": min(prices),
        "max_price": max(prices),
        "avg_price": round(statistics.mean(prices), 2),
        "median_price": statistics.median(prices),
    }




def compare_products(product_ids: list[str]) -> list[dict]:
    res = (
        get_client()
        .table(TABLE_NAME)
        .select(_select_all_columns())
        .in_(COLUMNS["id"], product_ids)
        .execute()
    )
    return res.data or []




def get_supplier_info(product_id: str) -> dict | None:
    """Seller name and source listing URL for a specific product."""
    cols = [COLUMNS["seller"], COLUMNS["source_url"]]
    res = (
        get_client()
        .table(TABLE_NAME)
        .select(", ".join(cols))
        .eq(COLUMNS["id"], product_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None




_OUT_OF_STOCK_MARKERS = ("out of stock", "sold out", "unavailable")
_IN_STOCK_MARKERS = ("in stock",)




def check_stock_availability(product_id: str) -> dict:
    """
    Best-effort stock check via keyword search in the free-text `notes`
    column. Returns "unknown" (not "in stock") when notes contains no
    stock-related language — notes mixes retailer type, VAT status, and
    stock status, so absence of a stock keyword is NOT evidence of
    availability. See SCHEMA_ASSUMPTIONS.md.
    """
    cols = [COLUMNS["notes"]]
    res = (
        get_client()
        .table(TABLE_NAME)
        .select(", ".join(cols))
        .eq(COLUMNS["id"], product_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return {"product_id": product_id, "found": False}
    notes = (rows[0].get(COLUMNS["notes"]) or "").lower()
    if any(marker in notes for marker in _OUT_OF_STOCK_MARKERS):
        status = "out_of_stock"
    elif any(marker in notes for marker in _IN_STOCK_MARKERS):
        status = "in_stock"
    else:
        status = "unknown"
    return {"product_id": product_id, "status": status, "raw_notes": rows[0].get(COLUMNS["notes"])}




def get_last_updated(product_id: str | None = None, category: str | None = None) -> dict:
    """
    Reports how stale a price is, using price_checked_at (a date, not a
    timestamp). Pass exactly one of product_id or category.
    """
    if product_id:
        res = (
            get_client()
            .table(TABLE_NAME)
            .select(COLUMNS["price_checked_at"])
            .eq(COLUMNS["id"], product_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return {"product_id": product_id, "found": False}
        checked = rows[0].get(COLUMNS["price_checked_at"])
        return {
            "product_id": product_id,
            "price_checked_at": checked,
            "days_old": _days_old(checked) if checked else None,
        }


    if category:
        res = (
            get_client()
            .table(TABLE_NAME)
            .select(COLUMNS["price_checked_at"])
            .eq(COLUMNS["category"], category)
            .execute()
        )
        dates = [r.get(COLUMNS["price_checked_at"]) for r in (res.data or []) if r.get(COLUMNS["price_checked_at"])]
        if not dates:
            return {"category": category, "count": 0}
        ages = [_days_old(d) for d in dates]
        return {
            "category": category,
            "count": len(dates),
            "oldest_days": max(ages),
            "newest_days": min(ages),
            "avg_days": round(statistics.mean(ages), 1),
        }


    raise ValueError("Pass either product_id or category, not neither.")




def _days_old(date_str: str) -> int:
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return (date.today() - d).days
