import math
import numpy as np


def predict_spread(
    wind_speed: float,
    wind_direction: float = 180.0,
    temperature: float = 35.0,
    humidity: float = 15.0,
    hours: int = 6,
) -> dict:
    """
    Compute predicted fire spread over N hours.
    Returns radius, direction, affected area, and hourly progression.
    """
    base_rate = wind_speed * 0.3  # km/h base spread
    temp_factor = 1.0 + max(0, temperature - 25) * 0.04
    humidity_factor = 1.0 + max(0, 40 - humidity) * 0.02
    rate_km_h = base_rate * temp_factor * humidity_factor

    progression = []
    for h in range(1, hours + 1):
        radius = rate_km_h * h * 0.5
        area = math.pi * radius ** 2
        dir_rad = math.radians(wind_direction)
        cx = math.sin(dir_rad) * radius * 0.3
        cy = math.cos(dir_rad) * radius * 0.3
        progression.append(
            {
                "hour": h,
                "radius_km": round(radius, 2),
                "area_km2": round(area, 2),
                "center_offset": {"x_km": round(cx, 2), "y_km": round(cy, 2)},
            }
        )

    final = progression[-1] if progression else {"radius_km": 0, "area_km2": 0}
    return {
        "spread_rate_km_h": round(rate_km_h, 2),
        "wind_direction_deg": wind_direction,
        "predicted_radius_km": final["radius_km"],
        "predicted_area_km2": final["area_km2"],
        "hours_predicted": hours,
        "hourly_progression": progression,
    }
