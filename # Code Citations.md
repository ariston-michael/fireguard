# Code Citations

## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: unknown
https://github.com/saiful00000/hack_book_PYTHON/blob/33d674e1d95ce825338d9e6ca8ba45e07ce853da/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: MIT
https://github.com/JoseJulianMosqueraFuli/fapro-test/blob/b9de39eb4e14b77265487051bbd8e8869eab6666/Dockerfile

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file
```


## License: unknown
https://github.com/saviomd/saviomd.github.io/blob/b814901010c513444f0ccbb73ff81ba64a5b409d/src/main.tsx

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file (at backend root – **not committed**)

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/.env
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
````

---

### Root-level files

#### 10. .env.example

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.env.example
# Copy this file to backend/.env and fill in your keys

GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
````

#### 11. docker-compose.yml

````yaml
# filepath: /Users/aristonmichael/Devs/fireguard-xr/docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
````

#### 12. .gitignore

````gitignore
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.gitignore
node_modules/
__pycache__/
*.pyc
.env
dist/
venv/
.DS_Store
````

---

### Frontend

#### 13. Scaffold the frontend (run these commands)

````bash
cd /Users/aristonmichael/Devs/fireguard-xr/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei axios leaflet react-leaflet
npm install -D @types/three @types/leaflet
````

#### 14. Frontend vite.config.ts

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
````

#### 15. Frontend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
````

#### 16. API service

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface FireAnalysisRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  latitude: number;
  longitude: number;
}

export interface RiskResult {
  score: number;
  level: string;
  spread_radius_km: number;
}

export interface AnalysisResponse {
  risk: RiskResult;
  water_contamination: string;
  ai_advice: string;
}

export async function getWildfireRisk(
  temperature = 35,
  humidity = 15,
  windSpeed = 25
) {
  const res = await api.get("/wildfire-risk", {
    params: { temperature, humidity, wind_speed: windSpeed },
  });
  return res.data;
}

export async function analyzeFire(
  data: FireAnalysisRequest
): Promise<AnalysisResponse> {
  const res = await api.post("/analyze-fire", data);
  return res.data;
}

export async function playVoiceAlert(text: string) {
  const res = await api.post("/voice-alert", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}
````

#### 17. FireScene.tsx (3D Wildfire Visualization)

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/components/FireScene.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface FireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.3;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(4, Math.floor(radius * 3));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

export default function FireScene({ spreadRadius }: FireSceneProps) {
  return (
    <div style={{ width: "100%", height: "500px", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={2} distance={20} />
        <Terrain />
        <FireSpread radius={spreadRadius} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
````

#### 18. Dashboard.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import FireScene from "../components/FireScene";
import {
  analyzeFire,
  playVoiceAlert,
  type AnalysisResponse,
} from "../services/api";

export default function Dashboard() {
  const [temperature, setTemperature] = useState(35);
  const [humidity, setHumidity] = useState(15);
  const [windSpeed, setWindSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const riskColor: Record<string, string> = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#f97316",
    Extreme: "#ef4444",
  };

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeFire({
        temperature,
        humidity,
        wind_speed: windSpeed,
        latitude: 49.28,
        longitude: -123.12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed – is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoice() {
    if (!result) return;
    const msg = `Warning! Wildfire risk is ${result.risk.level}. 
      Estimated spread radius ${result.risk.spread_radius_km} kilometers. 
      Water contamination risk is ${result.water_contamination}. 
      Please evacuate immediately if you are in the affected area.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      alert("Voice alert failed – check your ElevenLabs API key.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        🔥 FireGuard XR – Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation &amp; AI-powered risk analysis
      </p>

      {/* ---- Controls ---- */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label>
          🌡 Temp (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💧 Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💨 Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing…" : "🔍 Analyze Fire Risk"}
        </button>

        {result && (
          <button onClick={handleVoice} style={{ ...btnStyle, background: "#7c3aed" }}>
            🔊 Voice Alert
          </button>
        )}
      </div>

      {/* ---- 3D Scene ---- */}
      <FireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      {/* ---- Results ---- */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
          }}
        >
          <h2>
            Risk Level:{" "}
            <span style={{ color: riskColor[result.risk.level] }}>
              {result.risk.level}
            </span>{" "}
            (score {result.risk.score}/8)
          </h2>
          <p>🔥 Spread radius: {result.risk.spread_radius_km} km</p>
          <p>💧 Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>🤖 AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f1f5f9",
  width: 120,
};

const btnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};
````

#### 19. App.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/App.tsx
import Dashboard from "./pages/Dashboard";

export default function App() {
  return <Dashboard />;
}
````

#### 20. main.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```


## License: unknown
https://github.com/saviomd/saviomd.github.io/blob/b814901010c513444f0ccbb73ff81ba64a5b409d/src/main.tsx

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file (at backend root – **not committed**)

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/.env
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
````

---

### Root-level files

#### 10. .env.example

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.env.example
# Copy this file to backend/.env and fill in your keys

GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
````

#### 11. docker-compose.yml

````yaml
# filepath: /Users/aristonmichael/Devs/fireguard-xr/docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
````

#### 12. .gitignore

````gitignore
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.gitignore
node_modules/
__pycache__/
*.pyc
.env
dist/
venv/
.DS_Store
````

---

### Frontend

#### 13. Scaffold the frontend (run these commands)

````bash
cd /Users/aristonmichael/Devs/fireguard-xr/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei axios leaflet react-leaflet
npm install -D @types/three @types/leaflet
````

#### 14. Frontend vite.config.ts

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
````

#### 15. Frontend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
````

#### 16. API service

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface FireAnalysisRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  latitude: number;
  longitude: number;
}

export interface RiskResult {
  score: number;
  level: string;
  spread_radius_km: number;
}

export interface AnalysisResponse {
  risk: RiskResult;
  water_contamination: string;
  ai_advice: string;
}

export async function getWildfireRisk(
  temperature = 35,
  humidity = 15,
  windSpeed = 25
) {
  const res = await api.get("/wildfire-risk", {
    params: { temperature, humidity, wind_speed: windSpeed },
  });
  return res.data;
}

export async function analyzeFire(
  data: FireAnalysisRequest
): Promise<AnalysisResponse> {
  const res = await api.post("/analyze-fire", data);
  return res.data;
}

export async function playVoiceAlert(text: string) {
  const res = await api.post("/voice-alert", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}
````

#### 17. FireScene.tsx (3D Wildfire Visualization)

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/components/FireScene.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface FireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.3;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(4, Math.floor(radius * 3));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

export default function FireScene({ spreadRadius }: FireSceneProps) {
  return (
    <div style={{ width: "100%", height: "500px", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={2} distance={20} />
        <Terrain />
        <FireSpread radius={spreadRadius} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
````

#### 18. Dashboard.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import FireScene from "../components/FireScene";
import {
  analyzeFire,
  playVoiceAlert,
  type AnalysisResponse,
} from "../services/api";

export default function Dashboard() {
  const [temperature, setTemperature] = useState(35);
  const [humidity, setHumidity] = useState(15);
  const [windSpeed, setWindSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const riskColor: Record<string, string> = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#f97316",
    Extreme: "#ef4444",
  };

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeFire({
        temperature,
        humidity,
        wind_speed: windSpeed,
        latitude: 49.28,
        longitude: -123.12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed – is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoice() {
    if (!result) return;
    const msg = `Warning! Wildfire risk is ${result.risk.level}. 
      Estimated spread radius ${result.risk.spread_radius_km} kilometers. 
      Water contamination risk is ${result.water_contamination}. 
      Please evacuate immediately if you are in the affected area.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      alert("Voice alert failed – check your ElevenLabs API key.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        🔥 FireGuard XR – Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation &amp; AI-powered risk analysis
      </p>

      {/* ---- Controls ---- */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label>
          🌡 Temp (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💧 Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💨 Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing…" : "🔍 Analyze Fire Risk"}
        </button>

        {result && (
          <button onClick={handleVoice} style={{ ...btnStyle, background: "#7c3aed" }}>
            🔊 Voice Alert
          </button>
        )}
      </div>

      {/* ---- 3D Scene ---- */}
      <FireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      {/* ---- Results ---- */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
          }}
        >
          <h2>
            Risk Level:{" "}
            <span style={{ color: riskColor[result.risk.level] }}>
              {result.risk.level}
            </span>{" "}
            (score {result.risk.score}/8)
          </h2>
          <p>🔥 Spread radius: {result.risk.spread_radius_km} km</p>
          <p>💧 Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>🤖 AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f1f5f9",
  width: 120,
};

const btnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};
````

#### 19. App.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/App.tsx
import Dashboard from "./pages/Dashboard";

export default function App() {
  return <Dashboard />;
}
````

#### 20. main.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```


## License: unknown
https://github.com/saviomd/saviomd.github.io/blob/b814901010c513444f0ccbb73ff81ba64a5b409d/src/main.tsx

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file (at backend root – **not committed**)

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/.env
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
````

---

### Root-level files

#### 10. .env.example

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.env.example
# Copy this file to backend/.env and fill in your keys

GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
````

#### 11. docker-compose.yml

````yaml
# filepath: /Users/aristonmichael/Devs/fireguard-xr/docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
````

#### 12. .gitignore

````gitignore
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.gitignore
node_modules/
__pycache__/
*.pyc
.env
dist/
venv/
.DS_Store
````

---

### Frontend

#### 13. Scaffold the frontend (run these commands)

````bash
cd /Users/aristonmichael/Devs/fireguard-xr/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei axios leaflet react-leaflet
npm install -D @types/three @types/leaflet
````

#### 14. Frontend vite.config.ts

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
````

#### 15. Frontend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
````

#### 16. API service

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface FireAnalysisRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  latitude: number;
  longitude: number;
}

export interface RiskResult {
  score: number;
  level: string;
  spread_radius_km: number;
}

export interface AnalysisResponse {
  risk: RiskResult;
  water_contamination: string;
  ai_advice: string;
}

export async function getWildfireRisk(
  temperature = 35,
  humidity = 15,
  windSpeed = 25
) {
  const res = await api.get("/wildfire-risk", {
    params: { temperature, humidity, wind_speed: windSpeed },
  });
  return res.data;
}

export async function analyzeFire(
  data: FireAnalysisRequest
): Promise<AnalysisResponse> {
  const res = await api.post("/analyze-fire", data);
  return res.data;
}

export async function playVoiceAlert(text: string) {
  const res = await api.post("/voice-alert", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}
````

#### 17. FireScene.tsx (3D Wildfire Visualization)

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/components/FireScene.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface FireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.3;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(4, Math.floor(radius * 3));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

export default function FireScene({ spreadRadius }: FireSceneProps) {
  return (
    <div style={{ width: "100%", height: "500px", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={2} distance={20} />
        <Terrain />
        <FireSpread radius={spreadRadius} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
````

#### 18. Dashboard.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import FireScene from "../components/FireScene";
import {
  analyzeFire,
  playVoiceAlert,
  type AnalysisResponse,
} from "../services/api";

export default function Dashboard() {
  const [temperature, setTemperature] = useState(35);
  const [humidity, setHumidity] = useState(15);
  const [windSpeed, setWindSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const riskColor: Record<string, string> = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#f97316",
    Extreme: "#ef4444",
  };

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeFire({
        temperature,
        humidity,
        wind_speed: windSpeed,
        latitude: 49.28,
        longitude: -123.12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed – is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoice() {
    if (!result) return;
    const msg = `Warning! Wildfire risk is ${result.risk.level}. 
      Estimated spread radius ${result.risk.spread_radius_km} kilometers. 
      Water contamination risk is ${result.water_contamination}. 
      Please evacuate immediately if you are in the affected area.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      alert("Voice alert failed – check your ElevenLabs API key.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        🔥 FireGuard XR – Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation &amp; AI-powered risk analysis
      </p>

      {/* ---- Controls ---- */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label>
          🌡 Temp (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💧 Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💨 Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing…" : "🔍 Analyze Fire Risk"}
        </button>

        {result && (
          <button onClick={handleVoice} style={{ ...btnStyle, background: "#7c3aed" }}>
            🔊 Voice Alert
          </button>
        )}
      </div>

      {/* ---- 3D Scene ---- */}
      <FireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      {/* ---- Results ---- */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
          }}
        >
          <h2>
            Risk Level:{" "}
            <span style={{ color: riskColor[result.risk.level] }}>
              {result.risk.level}
            </span>{" "}
            (score {result.risk.score}/8)
          </h2>
          <p>🔥 Spread radius: {result.risk.spread_radius_km} km</p>
          <p>💧 Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>🤖 AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f1f5f9",
  width: 120,
};

const btnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};
````

#### 19. App.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/App.tsx
import Dashboard from "./pages/Dashboard";

export default function App() {
  return <Dashboard />;
}
````

#### 20. main.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```


## License: unknown
https://github.com/saviomd/saviomd.github.io/blob/b814901010c513444f0ccbb73ff81ba64a5b409d/src/main.tsx

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file (at backend root – **not committed**)

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/.env
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
````

---

### Root-level files

#### 10. .env.example

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.env.example
# Copy this file to backend/.env and fill in your keys

GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
````

#### 11. docker-compose.yml

````yaml
# filepath: /Users/aristonmichael/Devs/fireguard-xr/docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
````

#### 12. .gitignore

````gitignore
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.gitignore
node_modules/
__pycache__/
*.pyc
.env
dist/
venv/
.DS_Store
````

---

### Frontend

#### 13. Scaffold the frontend (run these commands)

````bash
cd /Users/aristonmichael/Devs/fireguard-xr/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei axios leaflet react-leaflet
npm install -D @types/three @types/leaflet
````

#### 14. Frontend vite.config.ts

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
````

#### 15. Frontend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
````

#### 16. API service

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface FireAnalysisRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  latitude: number;
  longitude: number;
}

export interface RiskResult {
  score: number;
  level: string;
  spread_radius_km: number;
}

export interface AnalysisResponse {
  risk: RiskResult;
  water_contamination: string;
  ai_advice: string;
}

export async function getWildfireRisk(
  temperature = 35,
  humidity = 15,
  windSpeed = 25
) {
  const res = await api.get("/wildfire-risk", {
    params: { temperature, humidity, wind_speed: windSpeed },
  });
  return res.data;
}

export async function analyzeFire(
  data: FireAnalysisRequest
): Promise<AnalysisResponse> {
  const res = await api.post("/analyze-fire", data);
  return res.data;
}

export async function playVoiceAlert(text: string) {
  const res = await api.post("/voice-alert", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}
````

#### 17. FireScene.tsx (3D Wildfire Visualization)

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/components/FireScene.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface FireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.3;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(4, Math.floor(radius * 3));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

export default function FireScene({ spreadRadius }: FireSceneProps) {
  return (
    <div style={{ width: "100%", height: "500px", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={2} distance={20} />
        <Terrain />
        <FireSpread radius={spreadRadius} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
````

#### 18. Dashboard.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import FireScene from "../components/FireScene";
import {
  analyzeFire,
  playVoiceAlert,
  type AnalysisResponse,
} from "../services/api";

export default function Dashboard() {
  const [temperature, setTemperature] = useState(35);
  const [humidity, setHumidity] = useState(15);
  const [windSpeed, setWindSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const riskColor: Record<string, string> = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#f97316",
    Extreme: "#ef4444",
  };

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeFire({
        temperature,
        humidity,
        wind_speed: windSpeed,
        latitude: 49.28,
        longitude: -123.12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed – is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoice() {
    if (!result) return;
    const msg = `Warning! Wildfire risk is ${result.risk.level}. 
      Estimated spread radius ${result.risk.spread_radius_km} kilometers. 
      Water contamination risk is ${result.water_contamination}. 
      Please evacuate immediately if you are in the affected area.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      alert("Voice alert failed – check your ElevenLabs API key.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        🔥 FireGuard XR – Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation &amp; AI-powered risk analysis
      </p>

      {/* ---- Controls ---- */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label>
          🌡 Temp (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💧 Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💨 Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing…" : "🔍 Analyze Fire Risk"}
        </button>

        {result && (
          <button onClick={handleVoice} style={{ ...btnStyle, background: "#7c3aed" }}>
            🔊 Voice Alert
          </button>
        )}
      </div>

      {/* ---- 3D Scene ---- */}
      <FireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      {/* ---- Results ---- */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
          }}
        >
          <h2>
            Risk Level:{" "}
            <span style={{ color: riskColor[result.risk.level] }}>
              {result.risk.level}
            </span>{" "}
            (score {result.risk.score}/8)
          </h2>
          <p>🔥 Spread radius: {result.risk.spread_radius_km} km</p>
          <p>💧 Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>🤖 AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f1f5f9",
  width: 120,
};

const btnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};
````

#### 19. App.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/App.tsx
import Dashboard from "./pages/Dashboard";

export default function App() {
  return <Dashboard />;
}
````

#### 20. main.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```


## License: unknown
https://github.com/saviomd/saviomd.github.io/blob/b814901010c513444f0ccbb73ff81ba64a5b409d/src/main.tsx

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file (at backend root – **not committed**)

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/.env
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
````

---

### Root-level files

#### 10. .env.example

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.env.example
# Copy this file to backend/.env and fill in your keys

GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
````

#### 11. docker-compose.yml

````yaml
# filepath: /Users/aristonmichael/Devs/fireguard-xr/docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
````

#### 12. .gitignore

````gitignore
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.gitignore
node_modules/
__pycache__/
*.pyc
.env
dist/
venv/
.DS_Store
````

---

### Frontend

#### 13. Scaffold the frontend (run these commands)

````bash
cd /Users/aristonmichael/Devs/fireguard-xr/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei axios leaflet react-leaflet
npm install -D @types/three @types/leaflet
````

#### 14. Frontend vite.config.ts

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
````

#### 15. Frontend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
````

#### 16. API service

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface FireAnalysisRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  latitude: number;
  longitude: number;
}

export interface RiskResult {
  score: number;
  level: string;
  spread_radius_km: number;
}

export interface AnalysisResponse {
  risk: RiskResult;
  water_contamination: string;
  ai_advice: string;
}

export async function getWildfireRisk(
  temperature = 35,
  humidity = 15,
  windSpeed = 25
) {
  const res = await api.get("/wildfire-risk", {
    params: { temperature, humidity, wind_speed: windSpeed },
  });
  return res.data;
}

export async function analyzeFire(
  data: FireAnalysisRequest
): Promise<AnalysisResponse> {
  const res = await api.post("/analyze-fire", data);
  return res.data;
}

export async function playVoiceAlert(text: string) {
  const res = await api.post("/voice-alert", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}
````

#### 17. FireScene.tsx (3D Wildfire Visualization)

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/components/FireScene.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface FireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.3;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(4, Math.floor(radius * 3));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

export default function FireScene({ spreadRadius }: FireSceneProps) {
  return (
    <div style={{ width: "100%", height: "500px", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={2} distance={20} />
        <Terrain />
        <FireSpread radius={spreadRadius} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
````

#### 18. Dashboard.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import FireScene from "../components/FireScene";
import {
  analyzeFire,
  playVoiceAlert,
  type AnalysisResponse,
} from "../services/api";

export default function Dashboard() {
  const [temperature, setTemperature] = useState(35);
  const [humidity, setHumidity] = useState(15);
  const [windSpeed, setWindSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const riskColor: Record<string, string> = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#f97316",
    Extreme: "#ef4444",
  };

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeFire({
        temperature,
        humidity,
        wind_speed: windSpeed,
        latitude: 49.28,
        longitude: -123.12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed – is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoice() {
    if (!result) return;
    const msg = `Warning! Wildfire risk is ${result.risk.level}. 
      Estimated spread radius ${result.risk.spread_radius_km} kilometers. 
      Water contamination risk is ${result.water_contamination}. 
      Please evacuate immediately if you are in the affected area.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      alert("Voice alert failed – check your ElevenLabs API key.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        🔥 FireGuard XR – Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation &amp; AI-powered risk analysis
      </p>

      {/* ---- Controls ---- */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label>
          🌡 Temp (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💧 Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💨 Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing…" : "🔍 Analyze Fire Risk"}
        </button>

        {result && (
          <button onClick={handleVoice} style={{ ...btnStyle, background: "#7c3aed" }}>
            🔊 Voice Alert
          </button>
        )}
      </div>

      {/* ---- 3D Scene ---- */}
      <FireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      {/* ---- Results ---- */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
          }}
        >
          <h2>
            Risk Level:{" "}
            <span style={{ color: riskColor[result.risk.level] }}>
              {result.risk.level}
            </span>{" "}
            (score {result.risk.score}/8)
          </h2>
          <p>🔥 Spread radius: {result.risk.spread_radius_km} km</p>
          <p>💧 Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>🤖 AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f1f5f9",
  width: 120,
};

const btnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};
````

#### 19. App.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/App.tsx
import Dashboard from "./pages/Dashboard";

export default function App() {
  return <Dashboard />;
}
````

#### 20. main.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```


## License: unknown
https://github.com/saviomd/saviomd.github.io/blob/b814901010c513444f0ccbb73ff81ba64a5b409d/src/main.tsx

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file (at backend root – **not committed**)

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/.env
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
````

---

### Root-level files

#### 10. .env.example

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.env.example
# Copy this file to backend/.env and fill in your keys

GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
````

#### 11. docker-compose.yml

````yaml
# filepath: /Users/aristonmichael/Devs/fireguard-xr/docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
````

#### 12. .gitignore

````gitignore
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.gitignore
node_modules/
__pycache__/
*.pyc
.env
dist/
venv/
.DS_Store
````

---

### Frontend

#### 13. Scaffold the frontend (run these commands)

````bash
cd /Users/aristonmichael/Devs/fireguard-xr/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei axios leaflet react-leaflet
npm install -D @types/three @types/leaflet
````

#### 14. Frontend vite.config.ts

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
````

#### 15. Frontend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
````

#### 16. API service

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface FireAnalysisRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  latitude: number;
  longitude: number;
}

export interface RiskResult {
  score: number;
  level: string;
  spread_radius_km: number;
}

export interface AnalysisResponse {
  risk: RiskResult;
  water_contamination: string;
  ai_advice: string;
}

export async function getWildfireRisk(
  temperature = 35,
  humidity = 15,
  windSpeed = 25
) {
  const res = await api.get("/wildfire-risk", {
    params: { temperature, humidity, wind_speed: windSpeed },
  });
  return res.data;
}

export async function analyzeFire(
  data: FireAnalysisRequest
): Promise<AnalysisResponse> {
  const res = await api.post("/analyze-fire", data);
  return res.data;
}

export async function playVoiceAlert(text: string) {
  const res = await api.post("/voice-alert", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}
````

#### 17. FireScene.tsx (3D Wildfire Visualization)

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/components/FireScene.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface FireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.3;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(4, Math.floor(radius * 3));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

export default function FireScene({ spreadRadius }: FireSceneProps) {
  return (
    <div style={{ width: "100%", height: "500px", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={2} distance={20} />
        <Terrain />
        <FireSpread radius={spreadRadius} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
````

#### 18. Dashboard.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import FireScene from "../components/FireScene";
import {
  analyzeFire,
  playVoiceAlert,
  type AnalysisResponse,
} from "../services/api";

export default function Dashboard() {
  const [temperature, setTemperature] = useState(35);
  const [humidity, setHumidity] = useState(15);
  const [windSpeed, setWindSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const riskColor: Record<string, string> = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#f97316",
    Extreme: "#ef4444",
  };

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeFire({
        temperature,
        humidity,
        wind_speed: windSpeed,
        latitude: 49.28,
        longitude: -123.12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed – is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoice() {
    if (!result) return;
    const msg = `Warning! Wildfire risk is ${result.risk.level}. 
      Estimated spread radius ${result.risk.spread_radius_km} kilometers. 
      Water contamination risk is ${result.water_contamination}. 
      Please evacuate immediately if you are in the affected area.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      alert("Voice alert failed – check your ElevenLabs API key.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        🔥 FireGuard XR – Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation &amp; AI-powered risk analysis
      </p>

      {/* ---- Controls ---- */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label>
          🌡 Temp (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💧 Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💨 Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing…" : "🔍 Analyze Fire Risk"}
        </button>

        {result && (
          <button onClick={handleVoice} style={{ ...btnStyle, background: "#7c3aed" }}>
            🔊 Voice Alert
          </button>
        )}
      </div>

      {/* ---- 3D Scene ---- */}
      <FireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      {/* ---- Results ---- */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
          }}
        >
          <h2>
            Risk Level:{" "}
            <span style={{ color: riskColor[result.risk.level] }}>
              {result.risk.level}
            </span>{" "}
            (score {result.risk.score}/8)
          </h2>
          <p>🔥 Spread radius: {result.risk.spread_radius_km} km</p>
          <p>💧 Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>🤖 AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f1f5f9",
  width: 120,
};

const btnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};
````

#### 19. App.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/App.tsx
import Dashboard from "./pages/Dashboard";

export default function App() {
  return <Dashboard />;
}
````

#### 20. main.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```


## License: unknown
https://github.com/saviomd/saviomd.github.io/blob/b814901010c513444f0ccbb73ff81ba64a5b409d/src/main.tsx

```


# FireGuard XR – Full Project Audit & Fix

I'll now audit your entire repository, identify all issues, and provide every missing/corrected file.

---

## A. Problems Found

| # | Issue | Location |
|---|-------|----------|
| 1 | `main.py` is minimal – no routes, no CORS, no config | `backend/app/main.py` |
| 2 | `requirements.txt` missing critical packages (`google-generativeai`, `cloudinary`, `httpx`) | `backend/` |
| 3 | No `config.py` for env var management | `backend/app/` |
| 4 | No route files (`wildfire.py`) | `backend/app/routes/` |
| 5 | No service files (`gemini_service.py`, `cloudinary_service.py`, `voice_service.py`) | `backend/app/services/` |
| 6 | No `Dockerfile` for backend | `backend/` |
| 7 | No `docker-compose.yml` at project root | root |
| 8 | No `.env.example` | root |
| 9 | Frontend likely not scaffolded or missing components | `frontend/` |
| 10 | No `FireScene.tsx` component | `frontend/src/components/` |
| 11 | No `Dashboard.tsx` page | `frontend/src/pages/` |
| 12 | No `api.ts` service | `frontend/src/services/` |
| 13 | No proper `App.tsx` wiring | `frontend/src/` |
| 14 | Tailscale setup docs missing | root |
| 15 | No `README.md` | root |

---

## B & C. All Files (Complete Corrected Code)

### Backend

#### 1. Environment config

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/__init__.py
````

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
````

#### 2. Backend main.py

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center – Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
````

#### 3. Wildfire routes

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/routes/wildfire.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import get_gemini_advice
from app.services.voice_service import generate_voice_alert
from app.services.cloudinary_service import upload_image_url
from fastapi.responses import StreamingResponse
import io

router = APIRouter()


# ---------- Models ----------

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


# ---------- Wildfire risk scoring ----------

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

    return {"score": score, "level": level, "spread_radius_km": round(spread_radius, 2)}


# ---------- Fire spread model ----------

def water_risk(distance_km: float) -> str:
    if distance_km < 5:
        return "High"
    if distance_km < 15:
        return "Medium"
    return "Low"


# ---------- Routes ----------

@router.get("/wildfire-risk")
def wildfire_risk(
    temperature: float = 35,
    humidity: float = 15,
    wind_speed: float = 25,
):
    """Quick risk check with query params."""
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
    """Full analysis: risk score + Gemini AI advice."""
    risk = compute_risk(req.temperature, req.humidity, req.wind_speed)

    prompt = (
        f"A wildfire is detected at coordinates ({req.latitude}, {req.longitude}). "
        f"Temperature is {req.temperature}°C, humidity {req.humidity}%, "
        f"wind speed {req.wind_speed} km/h. Risk level: {risk['level']}. "
        f"Estimated spread radius: {risk['spread_radius_km']} km. "
        "Provide a concise emergency analysis with evacuation recommendations "
        "and water contamination warnings."
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
    """Generate a spoken alert via ElevenLabs."""
    try:
        audio_bytes = await generate_voice_alert(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {str(e)}")


@router.post("/upload-image")
async def upload_image(req: ImageUploadRequest):
    """Upload a wildfire image to Cloudinary."""
    try:
        result = await upload_image_url(req.image_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")
````

#### 4. Gemini service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/gemini_service.py
import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in .env"

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text
````

#### 5. Voice service (ElevenLabs)

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/voice_service.py
import httpx
from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – change if needed


async def generate_voice_alert(text: str) -> bytes:
    """Generate speech audio bytes from ElevenLabs TTS API."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.content
````

#### 6. Cloudinary service

````python
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/app/services/cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    """Upload an image by URL to Cloudinary."""
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in .env")

    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
````

#### 7. requirements.txt

````text
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/requirements.txt
fastapi
uvicorn[standard]
python-dotenv
numpy
httpx
google-generativeai
cloudinary
pydantic
````

#### 8. Backend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
````

#### 9. .env file (at backend root – **not committed**)

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/backend/.env
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
````

---

### Root-level files

#### 10. .env.example

````bash
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.env.example
# Copy this file to backend/.env and fill in your keys

GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
````

#### 11. docker-compose.yml

````yaml
# filepath: /Users/aristonmichael/Devs/fireguard-xr/docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: unless-stopped
````

#### 12. .gitignore

````gitignore
# filepath: /Users/aristonmichael/Devs/fireguard-xr/.gitignore
node_modules/
__pycache__/
*.pyc
.env
dist/
venv/
.DS_Store
````

---

### Frontend

#### 13. Scaffold the frontend (run these commands)

````bash
cd /Users/aristonmichael/Devs/fireguard-xr/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei axios leaflet react-leaflet
npm install -D @types/three @types/leaflet
````

#### 14. Frontend vite.config.ts

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
````

#### 15. Frontend Dockerfile

````dockerfile
# filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
````

#### 16. API service

````typescript
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface FireAnalysisRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  latitude: number;
  longitude: number;
}

export interface RiskResult {
  score: number;
  level: string;
  spread_radius_km: number;
}

export interface AnalysisResponse {
  risk: RiskResult;
  water_contamination: string;
  ai_advice: string;
}

export async function getWildfireRisk(
  temperature = 35,
  humidity = 15,
  windSpeed = 25
) {
  const res = await api.get("/wildfire-risk", {
    params: { temperature, humidity, wind_speed: windSpeed },
  });
  return res.data;
}

export async function analyzeFire(
  data: FireAnalysisRequest
): Promise<AnalysisResponse> {
  const res = await api.post("/analyze-fire", data);
  return res.data;
}

export async function playVoiceAlert(text: string) {
  const res = await api.post("/voice-alert", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}
````

#### 17. FireScene.tsx (3D Wildfire Visualization)

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/components/FireScene.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface FireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.3;
      ref.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(4, Math.floor(radius * 3));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

export default function FireScene({ spreadRadius }: FireSceneProps) {
  return (
    <div style={{ width: "100%", height: "500px", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={2} distance={20} />
        <Terrain />
        <FireSpread radius={spreadRadius} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
````

#### 18. Dashboard.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import FireScene from "../components/FireScene";
import {
  analyzeFire,
  playVoiceAlert,
  type AnalysisResponse,
} from "../services/api";

export default function Dashboard() {
  const [temperature, setTemperature] = useState(35);
  const [humidity, setHumidity] = useState(15);
  const [windSpeed, setWindSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const riskColor: Record<string, string> = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#f97316",
    Extreme: "#ef4444",
  };

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeFire({
        temperature,
        humidity,
        wind_speed: windSpeed,
        latitude: 49.28,
        longitude: -123.12,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed – is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVoice() {
    if (!result) return;
    const msg = `Warning! Wildfire risk is ${result.risk.level}. 
      Estimated spread radius ${result.risk.spread_radius_km} kilometers. 
      Water contamination risk is ${result.water_contamination}. 
      Please evacuate immediately if you are in the affected area.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      alert("Voice alert failed – check your ElevenLabs API key.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        🔥 FireGuard XR – Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation &amp; AI-powered risk analysis
      </p>

      {/* ---- Controls ---- */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label>
          🌡 Temp (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💧 Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          💨 Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing…" : "🔍 Analyze Fire Risk"}
        </button>

        {result && (
          <button onClick={handleVoice} style={{ ...btnStyle, background: "#7c3aed" }}>
            🔊 Voice Alert
          </button>
        )}
      </div>

      {/* ---- 3D Scene ---- */}
      <FireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      {/* ---- Results ---- */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
          }}
        >
          <h2>
            Risk Level:{" "}
            <span style={{ color: riskColor[result.risk.level] }}>
              {result.risk.level}
            </span>{" "}
            (score {result.risk.score}/8)
          </h2>
          <p>🔥 Spread radius: {result.risk.spread_radius_km} km</p>
          <p>💧 Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>🤖 AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f1f5f9",
  width: 120,
};

const btnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};
````

#### 19. App.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/App.tsx
import Dashboard from "./pages/Dashboard";

export default function App() {
  return <Dashboard />;
}
````

#### 20. main.tsx

````tsx
// filepath: /Users/aristonmichael/Devs/fireguard-xr/frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

