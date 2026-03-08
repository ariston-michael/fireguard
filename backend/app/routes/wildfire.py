from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from app.services.fire_spread_model import predict_spread
from app.services.wildfire_prediction import full_prediction
from app.services.water_risk_model import water_risk as compute_water_risk
from app.utils.weather_api import get_weather, get_7day_forecast
from app.services.wildfire_prediction import wildfire_risk_score, risk_level
from datetime import datetime, timezone
import io

router = APIRouter()

# ── In-memory satellite state (hackathon demo) ──────────────────────────
_satellite_state = {
    "scanning": True,
    "interval_seconds": 10,
    "images_scanned": 0,
    "fires_detected": 0,
    "last_scan": None,
    "mode": "normal",  # normal | alert
}


class FireAnalysisRequest(BaseModel):
    temperature: float = 35.0
    humidity: float = 15.0
    wind_speed: float = 25.0
    latitude: float = 49.28
    longitude: float = -123.12


class VoiceRequest(BaseModel):
    text: str


class ImageUploadRequest(BaseModel):
    image_url: str


def compute_risk(temp: float, humidity: float, wind: float) -> dict:
    score = 0
    if temp > 30:
        score += 3
    if humidity < 20:
        score += 3
    if wind > 20:
        score += 2

    if score >= 7:
        level = "Extreme"
    elif score >= 5:
        level = "High"
    elif score >= 3:
        level = "Medium"
    else:
        level = "Low"

    spread_radius = wind * 0.3
    return {
        "score": score,
        "level": level,
        "spread_radius_km": round(spread_radius, 2),
    }


def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    risk = compute_risk(temperature, humidity, wind_speed)
    return {
        "input": {
            "temperature": temperature,
            "humidity": humidity,
            "wind_speed": wind_speed,
        },
        "risk": risk,
        "water_contamination": water_risk(risk["spread_radius_km"]),
    }


@router.post("/analyze-fire")
async def analyze_fire(req: FireAnalysisRequest):
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature} C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings in 150 words or less."
    )

    try:
        advice = await get_gemini_advice(prompt)
    except Exception as e:
        advice = f"AI analysis unavailable: {str(e)}"

    return {
        "risk": risk,
        "water_contamination": water_risk(risk["spread_radius_km"]),
        "ai_advice": advice,
    }


@router.post("/voice-alert")
async def voice_alert(req: VoiceRequest):
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Voice generation failed: {str(e)}"
        )


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")


# ── NEW ENDPOINTS ────────────────────────────────────────────────────────


@router.get("/weather")
async def weather(latitude: float = 49.28, longitude: float = -123.12):
    """Get current weather and hourly forecast for a location."""
    try:
        data = await get_weather(latitude, longitude)
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {str(e)}")


@router.get("/fire-prediction")
def fire_prediction(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
    wind_direction: float = 180,
    latitude: float = 49.28,
    longitude: float = -123.12,
    hours: int = 6,
):
    """Full fire spread prediction with hourly progression."""
    prediction = full_prediction(
        temperature, humidity, wind_speed, wind_direction, latitude, longitude
    )
    spread = predict_spread(
        wind_speed, wind_direction, temperature, humidity, hours
    )
    prediction["spread_model"] = spread
    prediction["water_contamination"] = compute_water_risk(
        spread["predicted_radius_km"]
    )
    return prediction


@router.get("/satellite-status")
def satellite_status():
    """Return current satellite scanning status."""
    _satellite_state["last_scan"] = datetime.now(timezone.utc).isoformat()
    return _satellite_state


class ImageAnalysisRequest(BaseModel):
    image_url: str
    latitude: float = 49.28
    longitude: float = -123.12


@router.post("/analyze-image")
async def analyze_image(req: ImageAnalysisRequest):
    """
    Upload satellite image to Cloudinary, then use Gemini to analyze
    for wildfire indicators (smoke, heat, burn patterns).
    """
    # Step 1: Upload to Cloudinary
    cloud_result = None
    try:
        cloud_result = await upload_image_url(req.image_url)
    except Exception:
        cloud_result = {"url": req.image_url, "note": "Cloudinary upload skipped"}

    # Step 2: AI analysis via Gemini
    prompt = (
        "Analyze this satellite image for wildfire indicators. "
        "Look for: smoke plumes, heat signatures, burn scars, ember spread. "
        f"Location coordinates: ({req.latitude}, {req.longitude}). "
        "Respond with JSON containing: "
        '{"fire_detected": true/false, "confidence": 0-100, '
        '"indicators": ["list of found indicators"], '
        '"severity": "none/low/medium/high/critical", '
        '"description": "brief description"}'
    )
    try:
        ai_result = await get_gemini_advice(prompt)
    except Exception as e:
        ai_result = f"AI analysis unavailable: {str(e)}"

    # Step 3: Update satellite state
    _satellite_state["images_scanned"] += 1
    _satellite_state["last_scan"] = datetime.now(timezone.utc).isoformat()

    return {
        "cloudinary": cloud_result,
        "analysis": ai_result,
        "satellite_state": _satellite_state,
    }


@router.get("/forecast")
async def forecast(latitude: float = 49.28, longitude: float = -123.12):
    """Get 7-day daily weather forecast for a location."""
    try:
        data = await get_7day_forecast(latitude, longitude)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Forecast fetch failed: {str(e)}"
        )


@router.get("/forecast-risk")
async def forecast_risk(latitude: float = 49.28, longitude: float = -123.12):
    """
    7-day wildfire risk prediction: combines daily weather forecast
    with the risk model to produce a risk score per day.
    """
    try:
        data = await get_7day_forecast(latitude, longitude)
        result = []
        for day in data.get("days", []):
            temp = day.get("temp_max", 30) or 30
            hum = day.get("humidity_min", 50) or 50
            wind = day.get("wind_speed_max", 10) or 10
            score = wildfire_risk_score(temp, hum, wind)
            level = risk_level(score)
            spread = predict_spread(wind, day.get("wind_direction", 180), temp, hum, 6)
            result.append(
                {
                    "date": day["date"],
                    "risk_score": score,
                    "risk_level": level,
                    "temp_max": temp,
                    "humidity_min": hum,
                    "wind_max": wind,
                    "spread_radius_km": spread["predicted_radius_km"],
                    "weather_code": day.get("weather_code", 0),
                }
            )
        return {"days": result}
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Forecast risk failed: {str(e)}"
        )

@router.get("/news")
async def wildfire_news():
    """
    Fetch recent wildfire-related news articles.
    Tries GDELT first (free, no key). Falls back to NewsAPI if configured.
    Results are cached for 5 minutes to avoid rate limits.
    """
    import httpx
    import time as _time
    from app.config import NEWS_API_KEY

    # ── In-memory cache (5 min TTL) ────────────────────────────────────
    now = _time.time()
    if (
        hasattr(wildfire_news, "_cache")
        and wildfire_news._cache
        and now - wildfire_news._cache_time < 300
    ):
        return {"articles": wildfire_news._cache}

    articles: list[dict] = []

    # ── Attempt 1: GDELT (free, no API key needed) ─────────────────────
    try:
        gdelt_url = (
            "https://api.gdeltproject.org/api/v2/doc/doc"
            "?query=wildfire%20sourcelang:english"
            "&mode=artlist&maxrecords=25"
            "&format=json&sort=datedesc"
        )
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(gdelt_url)
            if resp.status_code == 200:
                data = resp.json()
                raw = data.get("articles", [])
                seen_domains: set[str] = set()
                for a in raw:
                    domain = a.get("domain", "")
                    lang = a.get("language", "").lower()
                    if domain in seen_domains or lang not in ("english", ""):
                        continue
                    seen_domains.add(domain)
                    articles.append({
                        "title": a.get("title", ""),
                        "url": a.get("url", ""),
                        "source": domain,
                        "image": a.get("socialimage", ""),
                        "date": a.get("seendate", ""),
                    })
                    if len(articles) >= 10:
                        break
    except Exception:
        pass  # Fall through to NewsAPI

    # ── Attempt 2: NewsAPI (if GDELT failed/empty and key is set) ──────
    if not articles and NEWS_API_KEY:
        try:
            newsapi_url = (
                "https://newsapi.org/v2/everything"
                "?q=wildfire OR bushfire"
                "&sortBy=publishedAt&pageSize=10&language=en"
                f"&apiKey={NEWS_API_KEY}"
            )
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(newsapi_url)
                if resp.status_code == 200:
                    data = resp.json()
                    for a in data.get("articles", []):
                        articles.append({
                            "title": a.get("title", ""),
                            "url": a.get("url", ""),
                            "source": (a.get("source") or {}).get("name", ""),
                            "image": a.get("urlToImage", ""),
                            "date": a.get("publishedAt", ""),
                        })
        except Exception:
            pass

    if not articles:
        raise HTTPException(status_code=502, detail="No news sources available")

    # Cache the result
    wildfire_news._cache = articles
    wildfire_news._cache_time = now

    return {"articles": articles}

@router.get("/threats")
async def detected_threats(
    latitude: float = 49.28,
    longitude: float = -123.12,
):
    """
    Compute threat zones based on real weather + fire risk analysis.
    Uses current conditions and nearby grid points to identify high-risk areas.
    """
    import math

    try:
        weather_data = await get_weather(latitude, longitude)
        temp = weather_data.get("temperature", 25)
        humidity_list = weather_data.get("hourly", {}).get("humidity", [50])
        wind = weather_data.get("wind_speed", 10)
        wind_dir = weather_data.get("wind_direction", 180)

        current_hour = datetime.now().hour
        humidity = (
            humidity_list[current_hour]
            if len(humidity_list) > current_hour
            else 50
        )

        score = wildfire_risk_score(temp, humidity, wind)
        level = risk_level(score)

        threats = []
        # Generate threat zones around the location based on real conditions
        # Higher risk = more threat zones
        threat_count = 0
        if score >= 6:
            threat_count = 3
        elif score >= 4:
            threat_count = 2
        elif score >= 2:
            threat_count = 1

        wind_rad = math.radians(wind_dir)
        for i in range(threat_count):
            # Threats extend in wind direction (downwind)
            offset_km = 2 + i * 3
            dlat = (offset_km / 111) * math.cos(wind_rad + i * 0.4)
            dlng = (offset_km / (111 * math.cos(math.radians(latitude)))) * math.sin(
                wind_rad + i * 0.4
            )
            t_lat = round(latitude + dlat, 5)
            t_lng = round(longitude + dlng, 5)

            # Each threat severity based on distance from origin
            severity = "Critical" if i == 0 else ("High" if i == 1 else "Moderate")
            spread = predict_spread(wind, wind_dir, temp, humidity, 3)

            threats.append(
                {
                    "id": i + 1,
                    "latitude": t_lat,
                    "longitude": t_lng,
                    "severity": severity,
                    "radius_km": round(spread["predicted_radius_km"] * (1 - i * 0.2), 2),
                    "description": (
                        f"Threat zone {i + 1}: {severity} risk. "
                        f"Temp {temp}°C, humidity {humidity}%, wind {wind} km/h."
                    ),
                }
            )

        return {
            "total_threats": len(threats),
            "risk_level": level,
            "risk_score": score,
            "scan_time": datetime.now(timezone.utc).isoformat(),
            "conditions": {
                "temperature": temp,
                "humidity": humidity,
                "wind_speed": wind,
                "wind_direction": wind_dir,
            },
            "threats": threats,
        }
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Threat analysis failed: {str(e)}"
        )