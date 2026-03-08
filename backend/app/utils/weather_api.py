import httpx


async def get_weather(lat: float, lon: float) -> dict:
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current_weather=true"
        f"&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
        f"&forecast_days=1"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        weather = data.get("current_weather", {})
        hourly = data.get("hourly", {})

        # Build hourly arrays (up to 24 entries)
        temps = hourly.get("temperature_2m", [])[:24]
        humidities = hourly.get("relative_humidity_2m", [])[:24]
        wind_speeds = hourly.get("wind_speed_10m", [])[:24]
        wind_dirs = hourly.get("wind_direction_10m", [])[:24]
        times = hourly.get("time", [])[:24]

        return {
            "temperature": weather.get("temperature"),
            "wind_speed": weather.get("windspeed"),
            "wind_direction": weather.get("winddirection"),
            "weather_code": weather.get("weathercode"),
            "is_day": weather.get("is_day"),
            "hourly": {
                "time": times,
                "temperature": temps,
                "humidity": humidities,
                "wind_speed": wind_speeds,
                "wind_direction": wind_dirs,
            },
        }


async def get_7day_forecast(lat: float, lon: float) -> dict:
    """Fetch 7-day daily forecast from Open-Meteo (free, no API key)."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=temperature_2m_max,temperature_2m_min,weathercode,"
        f"wind_speed_10m_max,wind_direction_10m_dominant,"
        f"relative_humidity_2m_max,relative_humidity_2m_min,"
        f"precipitation_sum,uv_index_max"
        f"&timezone=auto"
        f"&forecast_days=7"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", {})

        days = []
        dates = daily.get("time", [])
        for i, date in enumerate(dates):
            days.append({
                "date": date,
                "temp_max": daily.get("temperature_2m_max", [None])[i],
                "temp_min": daily.get("temperature_2m_min", [None])[i],
                "weather_code": daily.get("weathercode", [0])[i],
                "wind_speed_max": daily.get("wind_speed_10m_max", [0])[i],
                "wind_direction": daily.get("wind_direction_10m_dominant", [0])[i],
                "humidity_max": daily.get("relative_humidity_2m_max", [0])[i],
                "humidity_min": daily.get("relative_humidity_2m_min", [0])[i],
                "precipitation": daily.get("precipitation_sum", [0])[i],
                "uv_index": daily.get("uv_index_max", [0])[i],
            })

        return {
            "timezone": data.get("timezone", "UTC"),
            "days": days,
        }
