def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"
