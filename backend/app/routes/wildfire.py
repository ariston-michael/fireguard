from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
import io

router = APIRouter()


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