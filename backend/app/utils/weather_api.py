import httpx


async def get_weather(lat: float, lon: float) -> dict:
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current_weather=true"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        weather = data.get("current_weather", {})
        return {
            "temperature": weather.get("temperature"),
            "wind_speed": weather.get("windspeed"),
            "wind_direction": weather.get("winddirection"),
        }
