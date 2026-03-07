def get_evacuation_routes(lat: float, lon: float) -> list:
    return [
        {
            "name": "Route A - Highway North",
            "direction": "North",
            "distance_km": 15.2,
            "estimated_time_min": 18,
        },
        {
            "name": "Route B - Coastal Road West",
            "direction": "West",
            "distance_km": 22.8,
            "estimated_time_min": 28,
        },
        {
            "name": "Route C - Mountain Pass East",
            "direction": "East",
            "distance_km": 30.1,
            "estimated_time_min": 35,
        },
    ]
