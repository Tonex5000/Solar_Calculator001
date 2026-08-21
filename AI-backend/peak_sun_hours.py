"""
Peak sun hours (PSH) by location — real per-coordinate data via NASA
POWER's climatology API, with a regional fallback for when geocoding or
the API call fails.


IMPORTANT: NASA POWER's climatology endpoint returns long-term AVERAGE
conditions (a "typical year"), not live weather or a forecast. It's the
right choice for system sizing (which should be robust to a normal year,
not today's weather), but should never be described to a user as
"today's" or "current" sun hours.


PSH is not the same as daylight length. It's the equivalent number of
hours at a flat 1000 W/m² that would deliver the same total energy as the
site's real, curved irradiance profile through the day — this module
returns PSH, which is what solar sizing math actually uses.
"""


import requests


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"


# Rough regional bands for Nigeria, used only when geocoding or the NASA
# call fails. These are NOT a substitute for the real per-coordinate figure
# — always prefer the NASA result when available, and always label which
# source a returned value came from.
REGIONAL_FALLBACK_BANDS = [
    # (min_latitude, max_latitude, label, avg_psh)
    (0, 7, "Southern Nigeria (coastal)", 4.0),
    (7, 10, "Middle Belt", 5.0),
    (10, 15, "Northern Nigeria", 6.0),
]


CHARGE_WINDOW_NOTE = (
    "Peak sun hours is a sizing figure, not a clock-hour window. In practice, "
    "panels produce close to their rated output roughly 9am-4pm, tapering "
    "sharply outside that range — daylight itself runs closer to 11.5-12.5 "
    "hours year-round this close to the equator, but most of that isn't "
    "useful production time."
)




def geocode_location(location: str) -> dict | None:
    """Resolve a place name to coordinates via OpenStreetMap Nominatim."""
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": location, "format": "json", "limit": 1},
            headers={"User-Agent": "Voltra-AI-Engineer/1.0"},
            timeout=8,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        return {
            "latitude": float(results[0]["lat"]),
            "longitude": float(results[0]["lon"]),
            "display_name": results[0].get("display_name", location),
        }
    except (requests.RequestException, KeyError, ValueError, IndexError):
        return None




def _fetch_nasa_power(lat: float, lon: float) -> dict | None:
    try:
        resp = requests.get(
            NASA_POWER_URL,
            params={
                "parameters": "ALLSKY_SFC_SW_DWN",
                "community": "RE",
                "longitude": lon,
                "latitude": lat,
                "format": "JSON",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        monthly = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
        return dict(monthly)  # kWh/m^2/day per month == PSH per month; includes "ANN" annual avg
    except (requests.RequestException, KeyError, ValueError):
        return None




def _regional_fallback(lat: float) -> dict:
    for min_lat, max_lat, label, psh in REGIONAL_FALLBACK_BANDS:
        if min_lat <= abs(lat) < max_lat:
            return {"region_label": label, "avg_psh": psh}
    # Outside the banded range entirely — return the northernmost band as a
    # rough default rather than failing outright, but flag it clearly.
    label, psh = REGIONAL_FALLBACK_BANDS[-1][2], REGIONAL_FALLBACK_BANDS[-1][3]
    return {"region_label": f"{label} (latitude outside expected Nigeria range)", "avg_psh": psh}




def get_peak_sun_hours(
    location: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict:
    """
    Peak sun hours for a location, preferring real NASA POWER data and
    falling back to a rough regional estimate if geocoding or the API call
    fails. Pass either `location` (a place name) or `latitude`+`longitude`
    directly — the latter skips geocoding and is more reliable.
    """
    resolved_name = location


    if latitude is None or longitude is None:
        if not location:
            raise ValueError("Pass either location, or both latitude and longitude.")
        geo = geocode_location(location)
        if geo is None:
            return {
                "resolved": False,
                "reason": (
                    f"Could not geocode '{location}'. Try a more specific place name, "
                    "or pass latitude/longitude directly."
                ),
            }
        latitude, longitude = geo["latitude"], geo["longitude"]
        resolved_name = geo["display_name"]


    nasa_result = _fetch_nasa_power(latitude, longitude)


    if nasa_result is not None:
        return {
            "resolved": True,
            "source": "nasa_power_climatology",
            "location": resolved_name,
            "latitude": latitude,
            "longitude": longitude,
            "annual_avg_psh": nasa_result.get("ANN"),
            "monthly_psh": {k: v for k, v in nasa_result.items() if k != "ANN"},
            "charge_window_note": CHARGE_WINDOW_NOTE,
            "data_note": (
                "Long-term average conditions (a 'typical year'), not live weather "
                "or a forecast — appropriate for system sizing, not day-to-day planning."
            ),
        }


    fallback = _regional_fallback(latitude)
    return {
        "resolved": True,
        "source": "regional_fallback",
        "location": resolved_name,
        "latitude": latitude,
        "longitude": longitude,
        "region_label": fallback["region_label"],
        "annual_avg_psh": fallback["avg_psh"],
        "charge_window_note": CHARGE_WINDOW_NOTE,
        "data_note": (
            "NASA POWER was unreachable, so this is a rough regional estimate, "
            "not a per-coordinate figure — treat it as a starting point, not a precise value."
        ),
    }
