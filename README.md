# FireGuard XR - Immersive Wildfire Command Center

Web-based immersive wildfire simulation with 3D visualization,
AI-powered risk analysis, voice alerts, and evacuation mapping.

## Tech Stack
- Frontend: React, Vite, TypeScript, Three.js
- Backend: Python, FastAPI
- AI: Google Gemini
- Voice: ElevenLabs TTS
- Media: Cloudinary
- Networking: Tailscale Funnel
- Deployment: Docker, Vultr

## Setup

### 1. Configure API Keys
cp .env.example backend/.env
# Edit backend/.env and paste your keys

### 2. Run with Docker
docker compose up --build
# Backend: http://localhost:8000/docs
# Frontend: http://localhost:5173

### 3. Run without Docker

Backend:
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

Frontend (new terminal):
cd frontend
npm install
npm run dev

### 4. Tailscale
open -a Tailscale
tailscale up
tailscale funnel 8000

## API Endpoints
- GET  /                  Health check
- GET  /api/wildfire-risk  Quick risk score
- POST /api/analyze-fire   Full AI analysis
- POST /api/voice-alert - POST /api/voice-alert - POST /api/voice-alert - POST /api/v##- POST /api/voice-alert - POST /api/voice-alert - POST /api/v    - POST /api/ |- POST /api/voice-alert - POST /api/voice-a---- POST /api/voice-alert -| - POST /api/voice   - POST /api/voice-aleroo- POST /api/voice-  - POST /api/voice-alert - POS h- POST /api/voice-alert -sett- Ps        |
| CLOUDINARY_CLOUD_NAME | https://console.cloudinary.com            |
| CLOUDINARY_API_KEY    | https://console.cloudinary.com            |
| CLOUDINARY_API_SECRET | https://console.cloudinary.com            |
