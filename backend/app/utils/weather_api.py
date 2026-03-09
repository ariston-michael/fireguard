import httpx
import time
import logging
from datetime import date

logger = logging.getLogger(__name__)

# ── In-memory cache (5-min TTL) ──────────────────────────────────────────
_weather_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 300  # seconds

def _cache_key(lat: float, lon: float, kind: str) -> str:
    return f"{kind}:{round(lat, 2)}:{round(lon, 2)}"


# ── wttr.in weather code mapping ────────────────────────────────────────
_WTTR_CODE_MAP = {
    "113": 0, "116": 2, "119": 3, "122": 3, "143": 45,
    "176": 61, "179": 71, "182": 67, "185": 67, "200": 95,
    "227": 77, "230": 75, "248": 48, "260": 48,
    "263": 51, "266": 53, "281": 56, "284": 57,
    "293": 61, "296": 63, "299": 63, "302": 65, "305": 65, "308": 65,
    "311": 56, "314": 57, "317": 67, "320": 67,
    "323": 71, "326": 71, "329": 73, "332": 73, "335": 75, "338": 75,
    "350": 77, "353": 80, "356": 82, "359": 82,
    "362": 85, "365": 85, "368": 86, "371": 86,
    "374": 77, "377": 77, "386": 95, "389": 99, "392": 95, "395": 75,
}


async def _wttr_fallback_current(lat: float, lon: float) -> dict:
    """Fallback: get current weather from wttr.in."""
    url = f"https://wttr.in/{lat},{lon}?format=j1"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers={"User-Agent": "FireGuardXR/1.0"})
        resp.raise_for_status()
        text = resp.text
        if not text or text.startswith("<!") or text.startswith("<html"):
            raise ValueError("wttr.in returned HTML instead of JSON")
        data = resp.json()
        cc = data["current_condition"][0]
        hourly_raw = data.get("weather", [{}])[0].get("hourly", [])

        temps, humids, wspeeds, wdirs, times = [], [], [], [], []
        today_str = date.today().isoformat()
        for h in hourly_raw:
            hour = int(h.get("time", "0")) // 100
            times.append(f"{today_str}T{hour:02d}:00")
            temps.append(float(h.get("tempC", 0)))
            humids.append(int(h.get("humidity", 0)))
            wspeeds.append(float(h.get("windspeedKmph", 0)))
            wdirs.append(int(h.get("winddirDegree", 0)))

        wmo = _WTTR_CODE_MAP.get(cc.get("weatherCode", "113"), 0)
        hour_now = time.localtime().tm_hour
        is_day = 1 if 6 <= hour_now <= 20 else 0

        return {
            "temperature": float(cc.get("temp_C", 0)),
            "wind_speed": float(cc.get("windspeedKmph", 0)),
            "wind_direction": int(cc.get("winddirDegree", 0)),
            "weather_code": wmo,
            "is_day": is_day,
            "hourly": {
                "time": times,
                "temperature": temps,
                "humidity": humids,
                "wind_speed": wspeeds,
                "wind_direction": wdirs,
            },
        }


async def _wttr_fallback_forecast(lat: float, lon: float) -> dict:
    """Fallback: get 7-day forecast from wttr.in (returns 3 days)."""
    url = f"https://wttr.in/{lat},{lon}?format=j1"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers={"User-Agent": "FireGuardXR/1.0"})
        resp.raise_for_status()
        text = resp.text
        if not text or text.startswith("<!") or text.startswith("<html"):
            raise ValueError("wttr.in returned HTML instead of JSON")
        data = resp.json()
        weather_days = data.get("weather", [])

        days = []
        for wd in weather_days:
            hourly = wd.get("hourly", [])
            h_max = max((int(h.get("humidity", 0)) for h in hourly), default=50)
            h_min = min((int(h.get("humidity", 0)) for h in hourly), default=30)
            precip = sum(float(h.get("precipMM", 0)) for h in hourly) / max(len(hourly), 1)
            wind_max = max((float(h.get("windspeedKmph", 0)) for h in hourly), default=0)
            wind_dir = int(hourly[len(hourly) // 2].get("winddirDegree", 0)) if hourly else 0
            wcode = _WTTR_CODE_MAP.get(hourly[len(hourly) // 2].get("weatherCode", "113"), 0) if hourly else 0

            days.append({
                "date": wd.get("date", ""),
                "temp_max": float(wd.get("maxtempC", 0)),
                "temp_min": float(wd.get("mintempC", 0)),
                "weather_code": wcode,
                "wind_speed_max": wind_max,
                "wind_direction": wind_dir,
                "humidity_max": h_max,
                "humidity_min": h_min,
                "precipitation": precip,
                "uv_index": float(wd.get("uvIndex", 0)),
            })

        return {"timezone": "auto", "days": days}


async def get_weather(lat: float, lon: float) -> dict:
    key = _cache_key(lat, lon, "current")
    if key in _weather_cache:
        ts, data = _weather_cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data

    # Try Open-Meteo first
    try:
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

            temps = hourly.get("temperature_2m", [])[:24]
            humidities = hourly.get("relative_humidity_2m", [])[:24]
            wind_speeds = hourly.get("wind_speed_10m", [])[:24]
            wind_dirs = hourly.get("wind_direction_10m", [])[:24]
            times_arr = hourly.get("time", [])[:24]

            result = {
                "temperature": weather.get("temperature"),
                "wind_speed": weather.get("windspeed"),
                "wind_direction": weather.get("winddirection"),
                "weather_code": weather.get("weathercode"),
                "is_day": weather.get("is_day"),
                "hourly": {
                    "time": times_arr,
                    "temperature": temps,
                    "humidity": humidities,
                    "wind_speed": wind_speeds,
                    "wind_direction": wind_dirs,
                },
            }
            _weather_cache[key] = (time.time(), result)
            return result
    except Exception as e:
        logger.warning(f"Open-Meteo failed ({e}), falling back to wttr.in")

    # Fallback: wttr.in
    try:
        result = await _wttr_fallback_current(lat, lon)
        _weather_cache[key] = (time.time(), result)
        return result
    except Exception as e:
        logger.warning(f"wttr.in fallback also failed ({type(e).__name__}: {e})")
        raise RuntimeError("All weather sources exhausted")


async def get_7day_forecast(lat: float, lon: float) -> dict:
    """Fetch 7-day daily forecast (Open-Meteo primary, wttr.in fallback)."""
    key = _cache_key(lat, lon, "forecast")
    if key in _weather_cache:
        ts, data = _weather_cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data

    # Try Open-Meteo first
    try:
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

            result = {"timezone": data.get("timezone", "UTC"), "days": days}
            _weather_cache[key] = (time.time(), result)
            return result
    except Exception as e:
        logger.warning(f"Open-Meteo forecast failed ({e}), falling back to wttr.in")

    # Fallback: wttr.in
    try:
        result = await _wttr_fallback_forecast(lat, lon)
        _weather_cache[key] = (time.time(), result)
        return result
    except Exception as e:
        logger.warning(f"wttr.in forecast fallback also failed ({type(e).__name__}: {e})")
        raise RuntimeError("All forecast sources exhausted")


async def get_air_quality(lat: float, lon: float) -> dict:
    """Fetch real-time Air Quality Index from Open-Meteo Air Quality API."""
    key = _cache_key(lat, lon, "aqi")
    if key in _weather_cache:
        ts, data = _weather_cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data

    try:
        url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={lat}&longitude={lon}"
            f"&current=us_aqi,european_aqi,pm10,pm2_5,"
            f"carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            current = data.get("current", {})

            us_aqi = current.get("us_aqi", 0) or 0

            # AQI category per EPA standard
            if us_aqi <= 50:
                category = "Good"
                health = "Air quality is satisfactory"
            elif us_aqi <= 100:
                category = "Moderate"
                health = "Acceptable; risk for sensitive groups"
            elif us_aqi <= 150:
                category = "Unhealthy (Sensitive)"
                health = "Sensitive groups may experience effects"
            elif us_aqi <= 200:
                category = "Unhealthy"
                health = "Health effects for everyone"
            elif us_aqi <= 300:
                category = "Very Unhealthy"
                health = "Serious health effects"
            else:
                category = "Hazardous"
                health = "Emergency conditions"

            result = {
                "aqi": us_aqi,
                "category": category,
                "health_message": health,
                "european_aqi": current.get("european_aqi", 0) or 0,
                "pollutants": {
                    "pm2_5": current.get("pm2_5", 0) or 0,
                    "pm10": current.get("pm10", 0) or 0,
                    "ozone": current.get("ozone", 0) or 0,
                    "nitrogen_dioxide": current.get("nitrogen_dioxide", 0) or 0,
                    "sulphur_dioxide": current.get("sulphur_dioxide", 0) or 0,
                    "carbon_monoxide": current.get("carbon_monoxide", 0) or 0,
                },
            }
            _weather_cache[key] = (time.time(), result)
            return result
    except Exception as e:
        logger.warning(f"Air Quality API failed ({e})")

    # ── Fallback: WAQI (World Air Quality Index) public feed ──────────
    try:
        url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token=demo"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "ok":
                aqi_data = data.get("data", {})
                us_aqi = int(aqi_data.get("aqi", 0))
                iaqi = aqi_data.get("iaqi", {})

                if us_aqi <= 50:
                    category = "Good"
                    health = "Air quality is satisfactory"
                elif us_aqi <= 100:
                    category = "Moderate"
                    health = "Acceptable; risk for sensitive groups"
                elif us_aqi <= 150:
                    category = "Unhealthy (Sensitive)"
                    health = "Sensitive groups may experience effects"
                elif us_aqi <= 200:
                    category = "Unhealthy"
                    health = "Health effects for everyone"
                elif us_aqi <= 300:
                    category = "Very Unhealthy"
                    health = "Serious health effects"
                else:
                    category = "Hazardous"
                    health = "Emergency conditions"

                result = {
                    "aqi": us_aqi,
                    "category": category,
                    "health_message": health,
                    "european_aqi": None,
                    "pollutants": {
                        "pm2_5": iaqi.get("pm25", {}).get("v", 0),
                        "pm10": iaqi.get("pm10", {}).get("v", 0),
                        "ozone": iaqi.get("o3", {}).get("v", 0),
                        "nitrogen_dioxide": iaqi.get("no2", {}).get("v", 0),
                        "sulphur_dioxide": iaqi.get("so2", {}).get("v", 0),
                        "carbon_monoxide": iaqi.get("co", {}).get("v", 0),
                    },
                }
                _weather_cache[key] = (time.time(), result)
                return result
    except Exception as e:
        logger.warning(f"WAQI fallback failed ({e})")

    return {
        "aqi": None,
        "category": "Unavailable",
        "health_message": "Air quality data not available",
        "european_aqi": None,
        "pollutants": {},
    }
