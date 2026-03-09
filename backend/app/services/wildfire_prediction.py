from datetime import datetime, timezone
import math


def wildfire_risk_score(temp: float, humidity: float, wind: float) -> int:
    """
    Continuous wildfire risk score (0–10) inspired by the Canadian
    Forest Fire Weather Index (FWI).  Uses temperature, relative humidity,
    and wind speed as primary inputs for a continuous assessment.
    """
    # Temperature component (0–3): fire behaviour increases sharply above 25 °C
    temp_component = max(0.0, min(3.0, (temp - 15) / 10 * 3))

    # Humidity component (0–4): drier air = higher risk, logarithmic
    if humidity <= 0:
        hum_component = 4.0
    else:
        hum_component = max(0.0, min(4.0, (100 - humidity) / 25))

    # Wind component (0–3): stronger wind spreads fire faster
    wind_component = max(0.0, min(3.0, wind / 15))

    raw = temp_component + hum_component + wind_component  # 0–10
    return min(10, round(raw))


def risk_level(score: int) -> str:
    if score >= 8:
        return "Extreme"
    if score >= 6:
        return "High"
    if score >= 4:
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

    # Spread rate using McArthur-inspired factors
    base_rate = wind_speed * 0.13  # km/h base from wind
    temp_factor = 1.0 + max(0, temperature - 25) * 0.035
    humidity_factor = 1.0 + max(0, 40 - humidity) * 0.025
    rate = base_rate * temp_factor * humidity_factor
    spread_radius = rate * 6  # 6-hour projected radius

    # Confidence metric: based on input completeness & reasonableness
    confidence = _compute_confidence(temperature, humidity, wind_speed)

    return {
        "risk_score": score,
        "risk_level": level,
        "spread_radius_km": round(spread_radius, 2),
        "spread_rate_km_h": round(rate, 2),
        "wind_direction": wind_direction,
        "location": {"latitude": latitude, "longitude": longitude},
        "detection_timestamp": datetime.now(timezone.utc).isoformat(),
        "fire_direction": _cardinal(wind_direction),
        "confidence": confidence,
    }


def _compute_confidence(temp: float, humidity: float, wind: float) -> int:
    """
    Prediction confidence (0–100) based on how much real sensor data
    is within normal operational ranges.  Returns lower confidence when
    inputs look like defaults or extremes (unreliable readings).
    """
    score = 70  # base confidence when using real weather

    # Penalise if values match hardcoded defaults (likely no real data)
    if temp == 35.0 and humidity == 15.0 and wind == 25.0:
        return 45  # clearly default values

    # Bonus for inputs in well-calibrated ranges
    if -10 <= temp <= 50:
        score += 8
    if 5 <= humidity <= 95:
        score += 8
    if 0 <= wind <= 80:
        score += 8

    # Small penalty for extreme values (less reliable prediction)
    if temp > 45 or temp < -5:
        score -= 5
    if humidity < 10 or humidity > 95:
        score -= 5
    if wind > 60:
        score -= 5

    return max(30, min(98, score))


def _cardinal(deg: float) -> str:
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = round(deg / 45) % 8
    return dirs[idx]
