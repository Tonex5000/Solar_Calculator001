# Confirmed Supabase schema (from real data sample, Solar Panels category)


This replaces the earlier assumed schema — the structure below is confirmed
against an actual export from the database, not guessed.


## Table: `products` (read access only — see README on keys/RLS)


| Column           | Type          | Example                                    |
|------------------|---------------|---------------------------------------------|
| id               | text          | "NSP-0001"                                   |
| category         | text          | "Solar Panels" — Title Case, multi-word      |
| subcategory      | text          | "Monocrystalline" / "Bifacial" / "Monofacial"|
| manufacturer     | text          | "JinkoSolar"                                 |
| model            | text          | "Tiger Neo 615W Bifacial"                    |
| rating           | text          | "565W" — human-readable, not for filtering   |
| power            | numeric       | 565 — parsed wattage, safe to filter/sort on |
| voltage          | text          | "1500V sys" — free text, not parsed          |
| current          | text          | "13.9A Imp" — free text, not parsed          |
| capacity         | text          | "565Wp" — free text, not parsed              |
| technology       | text          | "Mono PERC Half-cell, Monofacial"             |
| specifications   | text          | Free-text notes (warranty, efficiency, etc.) |
| price            | numeric       | 135000                                       |
| currency         | text          | "NGN"                                        |
| unit             | text          | "per panel"                                  |
| seller           | text          | "Solar Depot Nigeria"                        |
| source_url       | text          | Link to the actual product listing           |
| price_checked_at | date          | "2026-08-20" — date only, no time component  |
| notes            | text          | Mixed free text — see warning below          |


## Important: `power` is the only reliably numeric spec field confirmed so far


`rating`, `voltage`, `current`, and `capacity` are free-text strings with
units baked in (e.g. "565Wp", "13.9A Imp") — not safe to filter or sort on
numerically without parsing, and I'm not guessing at a parser for this
until the format is confirmed stable across categories. `power` is already
a clean number and is what `get_cheapest_match`/`search_products` filter
on for now.


## Open question: do other categories (battery, inverter, charge
controller, etc.) share these same column names with different meanings,
or do they use entirely different columns?


This matters because it decides whether one generic filtering function
works across the whole catalog, or whether each category needs its own
tool/logic. Not answered yet — see README for what's needed to close this.


## `notes` is not a reliable stock-status field


Observed values mix several unrelated things in one free-text column:
stock status ("In stock", "Out of stock"), retailer type ("Retail",
"Official distributor"), and tax status ("Excl. VAT"). `check_stock_availability`
does a best-effort case-insensitive check for "out of stock" but this is a
heuristic, not a guarantee — a row with no stock-related text in `notes`
gets reported as "unknown," not "in stock." If real-time stock accuracy
matters, this needs a dedicated boolean/enum column, not text-mining.


## What this server deliberately does NOT do


No `add_product`, `update_price`, or `delete_product` tool exists here, on
purpose. If you need those, build them as a *separate* admin-only MCP
server or script that isn't reachable by the customer-facing agent.
