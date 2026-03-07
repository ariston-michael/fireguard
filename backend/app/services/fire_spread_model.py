def predict_spread(wind_speed: float) -> dict:
    radius = wind_speed * 0.3
    return {"spread_radius_km": round(radius, 2)}
