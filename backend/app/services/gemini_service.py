import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


async def get_gemini_advice(prompt: str) -> str:
    if not GEMINI_API_KEY:
        return "Gemini API key not configured. Set GEMINI_API_KEY in backend/.env"
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)
    return response.text
