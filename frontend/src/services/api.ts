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
  const res = await api.post(
    "/voice-alert",
    { text },
    { responseType: "blob" }
  );
  const url = URL.createObjectURL(res.data);
  const audio = new Audio(url);
  audio.play();
}

export async function uploadImage(imageUrl: string) {
  const res = await api.post("/upload-image", { image_url: imageUrl });
  return res.data;
}
