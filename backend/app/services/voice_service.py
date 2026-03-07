import httpx

from app.config import ELEVENLABS_API_KEY

VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


async def generate_voice_alert(text: str) -> bytes:
    if not ELEVENLABS_API_KEY:
        raise ValueError(
            "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in backend/.env"
        )

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
