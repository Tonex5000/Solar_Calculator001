# Reference data needed


Two things unlock full functionality across the new tools. Neither needs
code changes on your end — just data.


## 1. Ampacity table (unlocks real cable safety checks)


`mcp_server/engineering.py` has:


```python
AMPACITY_TABLE: dict[str, dict[float, float]] = {}
```


Fill it in as `{material: {cross_section_mm2: max_continuous_amps}}`, e.g.:


```python
AMPACITY_TABLE = {
    "copper": {
        1.5: 17.5,
        2.5: 24,
        4: 32,
        6: 41,
        10: 57,
        16: 76,
        # ...
    },
    "aluminum": {
        # ...
    },
}
```


Source this from whatever standard actually governs your installations —
IEC 60364-5-52 tables are the common reference, but installation method
(conduit vs free air vs buried) changes the numbers meaningfully, so pick
the table matching how Voltra's recommended installs are actually done.
If you only have one installation method in practice, one table is enough
— don't over-build this into multiple methods until you need to.


Until this is filled in, `size_cable` and `check_system_safety` will keep
reporting `"insufficient_reference_data"` for ampacity — that's intentional
and correct behavior, not a bug.


## 2. Battery and inverter category sample rows (unlocks catalog matching)


`mcp_server/design.py` has `match_battery_to_target` and
`match_inverter_to_target` fully stubbed — they raise
`SchemaNotConfirmedError` on purpose rather than guess which column holds
a battery's Ah rating or an inverter's kVA rating.


To unblock: paste one real sample row each for your battery and inverter
categories (same JSON format as the Solar Panels sample), the same way you
did for panels. Once I see the actual column names and value formats, I'll
implement the two match functions for real — likely following the same
pattern as `select_best_value_panel`, but only once confirmed, not before.


Also worth pasting alongside those: the output of `get_categories()` once
you've filled in `SUPABASE_URL`/`SUPABASE_KEY` and can actually query the
DB — this confirms the real category name strings, since
`CATEGORY_NAMES["battery"]`/`["inverter"]` in `design.py` are currently
guesses ("Batteries" / "Inverters") based on the "Solar Panels" naming
pattern, not confirmed values.
