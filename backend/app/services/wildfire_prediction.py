from datetime import datetime, timezone


def wildfire_risk_score(temp: float, humidity: float, wind: float) -> int:
    score = 0
    if temp > 30:
        score += 3
    if humidity < 20:
        score += 3
    if wind > 20:
        score += 2
    return score


def risk_level(score: int) -> str:
    if score >= 7:
        return "Extreme"
    if score >= 5:
        return "High"
    if score >= 3:
        return "Medium"
    return "Low"


def full_prediction(
    temperature: float,
    humidity: float,
    wind_speed: float,
    wind_direction: float = 180.0,
    latitude: float = 49.28,
    longitude: float = -123.12,
) -> dict:
    score = wildfire_risk_score(temperature, humidity, wind_speed)
    level = risk_level(score)
    spread_radius = wind_speed * 0.3
    temp_factor = 1.0 + max(0, temperature - 25) * 0.04
    humidity_factor = 1.0 + max(0, 40 - humidity) * 0.02
    rate = spread_radius * temp_factor * humidity_factor

    return {
        "risk_score": score,
        "risk_level": level,
        "spread_radius_km": round(spread_radius, 2),
        "spread_rate_km_h": round(rate, 2),
        "wind_direction": wind_direction,
        "location": {"latitude": latitude, "longitude": longitude},
        "detection_timestamp": datetime.now(timezone.utc).isoformat(),
        "fire_direction": _cardinal(wind_direction),
    }


def _cardinal(deg: float) -> str:
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = round(deg / 45) % 8
    return dirs[idx]
