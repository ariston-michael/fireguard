import httpx
import math
import logging
from app.config import GOOGLE_MAPS_API_KEY

logger = logging.getLogger(__name__)

# Cardinal directions for evacuation (away from fire origin)
_DIRECTIONS = [
    ("North", 0),
    ("East", 90),
    ("South", 180),
    ("West", 270),
]

# Evacuation target distance in km
_EVAC_DIST_KM = 20


def _offset_point(lat: float, lon: float, bearing_deg: float, dist_km: float):
    """Calculate a destination point given bearing and distance."""
    R = 6371  # Earth radius km
    d = dist_km / R
    brng = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)

    lat2 = math.asin(
        math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brng)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(d) * math.cos(lat1),
        math.cos(d) - math.sin(lat1) * math.sin(lat2),
    )
    return round(math.degrees(lat2), 6), round(math.degrees(lon2), 6)


async def get_evacuation_routes(lat: float, lon: float) -> list:
    """
    Generate real evacuation routes using Google Maps Directions API.
    Computes routes in 4 cardinal directions away from the fire.
    Falls back to OSRM (free) if Google Maps key is unavailable.
    """
    routes = []

    for direction_name, bearing in _DIRECTIONS:
        dest_lat, dest_lon = _offset_point(lat, lon, bearing, _EVAC_DIST_KM)

        route_info = await _fetch_route(lat, lon, dest_lat, dest_lon, direction_name)
        if route_info:
            routes.append(route_info)

    # Sort by travel time (fastest first)
    routes.sort(key=lambda r: r.get("estimated_time_min", 999))
    return routes


async def _fetch_route(
    orig_lat: float, orig_lon: float,
    dest_lat: float, dest_lon: float,
    direction_name: str,
) -> dict | None:
    """Try Google Maps Directions API first, then OSRM fallback."""

    # ── Google Maps Directions API ───────────────────────────────────
    if GOOGLE_MAPS_API_KEY:
        try:
            url = (
                f"https://maps.googleapis.com/maps/api/directions/json"
                f"?origin={orig_lat},{orig_lon}"
                f"&destination={dest_lat},{dest_lon}"
                f"&key={GOOGLE_MAPS_API_KEY}"
            )
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()

                if data.get("status") == "OK" and data.get("routes"):
                    leg = data["routes"][0]["legs"][0]
                    dist_m = leg["distance"]["value"]
                    dur_s = leg["duration"]["value"]
                    summary = data["routes"][0].get("summary", "")
                    return {
                        "name": f"Route {direction_name}" + (f" — {summary}" if summary else ""),
                        "direction": direction_name,
                        "distance_km": round(dist_m / 1000, 1),
                        "estimated_time_min": round(dur_s / 60),
                        "destination": {"latitude": dest_lat, "longitude": dest_lon},
                        "source": "google_maps",
                    }
        except Exception as e:
            logger.warning(f"Google Maps route failed for {direction_name}: {e}")

    # ── OSRM fallback (free, no key) ────────────────────────────────
    try:
        url = (
            f"https://router.project-osrm.org/route/v1/driving/"
            f"{orig_lon},{orig_lat};{dest_lon},{dest_lat}"
            f"?overview=false"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                dist_m = route["distance"]
                dur_s = route["duration"]
                return {
                    "name": f"Route {direction_name}",
                    "direction": direction_name,
                    "distance_km": round(dist_m / 1000, 1),
                    "estimated_time_min": round(dur_s / 60),
                    "destination": {"latitude": dest_lat, "longitude": dest_lon},
                    "source": "osrm",
                }
    except Exception as e:
        logger.warning(f"OSRM route failed for {direction_name}: {e}")

    return None
