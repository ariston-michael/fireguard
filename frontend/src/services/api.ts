import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// ── Types ───────────────────────────────────────────────────────────────

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

export interface HourlyData {
  time: string[];
  temperature: number[];
  humidity: number[];
  wind_speed: number[];
  wind_direction: number[];
}

export interface WeatherResponse {
  temperature: number;
  wind_speed: number;
  wind_direction: number;
  weather_code: number;
  is_day: number;
  hourly: HourlyData;
}

export interface SpreadProgression {
  hour: number;
  radius_km: number;
  area_km2: number;
  center_offset: { x_km: number; y_km: number };
}

export interface FirePredictionResponse {
  risk_score: number;
  risk_level: string;
  spread_radius_km: number;
  spread_rate_km_h: number;
  wind_direction: number;
  location: { latitude: number; longitude: number };
  detection_timestamp: string;
  fire_direction: string;
  water_contamination: string;
  spread_model: {
    spread_rate_km_h: number;
    wind_direction_deg: number;
    predicted_radius_km: number;
    predicted_area_km2: number;
    hours_predicted: number;
    hourly_progression: SpreadProgression[];
  };
}

export interface SatelliteStatus {
  scanning: boolean;
  interval_seconds: number;
  images_scanned: number;
  fires_detected: number;
  last_scan: string | null;
  mode: string;
}

export interface ForecastDay {
  date: string;
  temp_max: number;
  temp_min: number;
  weather_code: number;
  wind_speed_max: number;
  wind_direction: number;
  humidity_max: number;
  humidity_min: number;
  precipitation: number;
  uv_index: number;
}

export interface ForecastResponse {
  timezone: string;
  days: ForecastDay[];
}

export interface ForecastRiskDay {
  date: string;
  risk_score: number;
  risk_level: string;
  temp_max: number;
  humidity_min: number;
  wind_max: number;
  spread_radius_km: number;
  weather_code: number;
}

export interface ForecastRiskResponse {
  days: ForecastRiskDay[];
}

export interface Threat {
  id: number;
  latitude: number;
  longitude: number;
  severity: string;
  radius_km: number;
  description: string;
}

export interface ThreatsResponse {
  total_threats: number;
  risk_level: string;
  risk_score: number;
  scan_time: string;
  conditions: {
    temperature: number;
    humidity: number;
    wind_speed: number;
    wind_direction: number;
  };
  threats: Threat[];
}

// ── API calls ───────────────────────────────────────────────────────────

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

export async function getWeather(
  latitude = 49.28,
  longitude = -123.12
): Promise<WeatherResponse> {
  const res = await api.get("/weather", { params: { latitude, longitude } });
  return res.data;
}

export async function getFirePrediction(params: {
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  wind_direction?: number;
  latitude?: number;
  longitude?: number;
  hours?: number;
}): Promise<FirePredictionResponse> {
  const res = await api.get("/fire-prediction", { params });
  return res.data;
}

export async function getSatelliteStatus(): Promise<SatelliteStatus> {
  const res = await api.get("/satellite-status");
  return res.data;
}

export async function getForecast(
  latitude = 49.28,
  longitude = -123.12
): Promise<ForecastResponse> {
  const res = await api.get("/forecast", { params: { latitude, longitude } });
  return res.data;
}

export async function getForecastRisk(
  latitude = 49.28,
  longitude = -123.12
): Promise<ForecastRiskResponse> {
  const res = await api.get("/forecast-risk", {
    params: { latitude, longitude },
  });
  return res.data;
}

export async function getThreats(
  latitude = 49.28,
  longitude = -123.12
): Promise<ThreatsResponse> {
  const res = await api.get("/threats", { params: { latitude, longitude } });
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
