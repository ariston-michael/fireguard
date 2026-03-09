import { useState, useEffect, useCallback, useRef } from "react";
import LocationSearch from "./LocationSearch";
import WeatherPanel from "./WeatherPanel";
import MetricsCards from "./MetricsCards";
import MapPanel from "./MapPanel";
import AIAnalysisPanel from "./AIAnalysisPanel";
import ChartsDashboard from "./ChartsDashboard";
import SatelliteStatus from "./SatelliteStatus";
import ForecastPanel from "./ForecastPanel";
import WildfireNews from "./WildfireNews";
import {
  getWeather,
  getFirePrediction,
  analyzeFire,
  getThreats,
  getForecast,
  getForecastRisk,
  getAirQuality,
  playVoiceAlert,
} from "../../services/api";
import type {
  WeatherResponse,
  FirePredictionResponse,
  AnalysisResponse,
  Threat,
  ForecastDay,
  ForecastRiskDay,
  AirQualityResponse,
} from "../../services/api";

/* ── Date / Time formatter ──────────────────────────────────────────── */
function useDateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return { dateStr, timeStr };
}

export default function Dashboard() {
  // Location — null until GPS resolves (or fallback)
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationName, setLocationName] = useState("");

  // Data
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [prediction, setPrediction] = useState<FirePredictionResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [threatRiskLevel, setThreatRiskLevel] = useState("Low");
  const [threatScanTime, setThreatScanTime] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [riskForecast, setRiskForecast] = useState<ForecastRiskDay[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualityResponse | null>(null);

  // UI
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const gpsRequested = useRef(false);

  // Date/time
  const { dateStr, timeStr } = useDateTime();

  // Derived values
  const temp = weather?.temperature ?? null;
  const humidity =
    weather?.hourly?.humidity?.[new Date().getHours()] ?? null;
  const windSpeed = weather?.wind_speed ?? null;
  const windDir = weather?.wind_direction ?? null;
  const riskLevel = prediction?.risk_level ?? "Low";
  const riskScore = prediction?.risk_score ?? 0;
  const spreadRadius = prediction?.spread_radius_km ?? 0;
  const waterRisk = prediction?.water_contamination ?? "Low";

  // ── GPS auto-prompt on first load ────────────────────────────────────
  useEffect(() => {
    if (gpsRequested.current) return;
    gpsRequested.current = true;

    if (!navigator.geolocation) {
      // No geolocation support — fall back to default
      setLat(49.28);
      setLng(-123.12);
      setLocationName("Vancouver, BC");
      return;
    }

    // Helper to reverse-geocode and set location
    async function resolveLocation(latitude: number, longitude: number) {
      setLat(latitude);
      setLng(longitude);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
        );
        const data = await res.json();
        const name =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.display_name?.split(",").slice(0, 2).join(", ") ||
          "Current Location";
        setLocationName(name);
      } catch {
        setLocationName("Current Location");
      }
    }

    // Try browser geolocation first
    navigator.geolocation.getCurrentPosition(
      (pos) => resolveLocation(pos.coords.latitude, pos.coords.longitude),
      async () => {
        // Browser GPS denied/failed — try IP-based geolocation
        try {
          const ipRes = await fetch("https://ipapi.co/json/");
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            resolveLocation(ipData.latitude, ipData.longitude);
            return;
          }
        } catch { /* ignore */ }
        // Final fallback
        setLat(49.28);
        setLng(-123.12);
        setLocationName("Vancouver, BC");
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  // ── Fetch weather + prediction + threats for current location ────────
  const fetchData = useCallback(async () => {
    if (lat === null || lng === null) return; // wait for GPS
    try {
      const [w, p, t, aq] = await Promise.all([
        getWeather(lat, lng),
        getFirePrediction({
          temperature: weather?.temperature ?? 35,
          humidity: humidity ?? 15,
          wind_speed: weather?.wind_speed ?? 25,
          wind_direction: weather?.wind_direction ?? 180,
          latitude: lat,
          longitude: lng,
        }),
        getThreats(lat, lng),
        getAirQuality(lat, lng),
      ]);
      setWeather(w);
      setPrediction(p);
      setThreats(t.threats);
      setThreatRiskLevel(t.risk_level);
      setThreatScanTime(t.scan_time);
      setAirQuality(aq);
    } catch (err) {
      console.error("Data fetch failed:", err);
    }
  }, [lat, lng, weather?.temperature, weather?.wind_speed, weather?.wind_direction, humidity]);

  // ── Fetch 7-day forecast (separate, less frequent) ───────────────────
  const fetchForecast = useCallback(async () => {
    if (lat === null || lng === null) return; // wait for GPS
    try {
      const [fc, fr] = await Promise.all([
        getForecast(lat, lng),
        getForecastRisk(lat, lng),
      ]);
      setForecast(fc.days);
      setRiskForecast(fr.days);
    } catch (err) {
      console.error("Forecast fetch failed:", err);
    }
  }, [lat, lng]);

  // Initial load + auto-refresh every 2 min
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 120000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Forecast: load on location change (every 5 min refresh)
  useEffect(() => {
    fetchForecast();
    const id = setInterval(fetchForecast, 300000);
    return () => clearInterval(id);
  }, [fetchForecast]);

  // ── When location changes, refetch with real weather ─────────────────
  function handleLocationChange(newLat: number, newLng: number, name: string) {
    setLat(newLat);
    setLng(newLng);
    setLocationName(name);
    setAnalysis(null); // reset old analysis
  }

  // ── Run AI fire analysis ─────────────────────────────────────────────
  async function handleAnalyze() {
    setAnalysisLoading(true);
    try {
      const res = await analyzeFire({
        temperature: temp ?? 35,
        humidity: humidity ?? 15,
        wind_speed: windSpeed ?? 25,
        latitude: lat ?? 0,
        longitude: lng ?? 0,
      });
      setAnalysis(res);
    } catch {
      /* ignore */
    } finally {
      setAnalysisLoading(false);
    }
  }

  // ── Map click → pick location ────────────────────────────────────────
  async function handleMapClick(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    setAnalysis(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&zoom=10`
      );
      const data = await res.json();
      const name =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.display_name?.split(",").slice(0, 2).join(", ") ||
        "Selected Location";
      setLocationName(name);
    } catch {
      setLocationName("Selected Location");
    }
  }

  // ── Emergency voice alert ────────────────────────────────────────────
  async function handleEmergencyVoice() {
    setVoiceSpeaking(true);
    const msg =
      `Emergency wildfire alert for ${locationName}. ` +
      `Risk level is ${riskLevel}. ` +
      `Estimated fire spread radius is ${spreadRadius} kilometers. ` +
      `Wind speed is ${windSpeed ?? "unknown"} kilometers per hour. ` +
      `Water contamination risk is ${waterRisk}. ` +
      `${threats.length} threat zones detected. ` +
      `Please follow evacuation routes immediately.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      /* Voice unavailable */
    } finally {
      setVoiceSpeaking(false);
    }
  }

  return (
    <>
      <div className="dashboard-bg" />
      <div className="dashboard">
        {/* ── App title ──────────────────────────────────────────────── */}
        <h1 className="app-title">FireGuard XR</h1>

        {/* ── Top bar ────────────────────────────────────────────────── */}
        <header className="top-bar">
        <LocationSearch onLocationChange={handleLocationChange} />
        <WeatherPanel
          temperature={temp}
          windSpeed={windSpeed}
          windDirection={windDir}
          weatherCode={weather?.weather_code ?? null}
          isDay={weather?.is_day ?? null}
          locationName={locationName}
        />
        <button
          className="btn btn-emergency"
          onClick={handleEmergencyVoice}
          disabled={voiceSpeaking}
        >
          {voiceSpeaking ? "Broadcasting..." : "Emergency Alert"}
        </button>
        <div className="datetime-display">
          <span className="datetime-date">{dateStr}</span>
          <span className="datetime-time">{timeStr}</span>
        </div>
      </header>

      {/* ── Threat detection strip ─────────────────────────────────── */}
      <SatelliteStatus
        threats={threats}
        riskLevel={threatRiskLevel}
        scanTime={threatScanTime}
        scanning={true}
      />

      {/* ── Metrics cards ──────────────────────────────────────────── */}
      <MetricsCards
        temperature={temp}
        humidity={humidity}
        windSpeed={windSpeed}
        riskLevel={riskLevel}
        riskScore={riskScore}
        spreadRadius={spreadRadius}
        waterRisk={waterRisk}
        satelliteScans={threats.length}
        aqi={airQuality?.aqi ?? null}
        aqiCategory={airQuality?.category ?? "Loading..."}
        aqiHealth={airQuality?.health_message ?? ""}
        confidence={prediction?.confidence ?? 0}
      />

      {/* ── Side-by-side maps + info strip ─────────────────────────── */}
      <MapPanel
        center={[lat ?? 0, lng ?? 0]}
        spreadRadiusKm={spreadRadius}
        riskLevel={riskLevel}
        detectionTimestamp={prediction?.detection_timestamp ?? null}
        fireDirection={prediction?.fire_direction ?? "N/A"}
        windDirection={windDir ?? 180}
        onMapClick={handleMapClick}
        threats={threats}
      />

      {/* ── 7-Day Forecast & Risk ──────────────────────────────────── */}
      <ForecastPanel forecast={forecast} riskForecast={riskForecast} />

      {/* ── AI Analysis Panel ──────────────────────────────────────── */}
      <AIAnalysisPanel
        advice={analysis?.ai_advice ?? null}
        riskLevel={analysis?.risk?.level ?? riskLevel}
        spreadRadius={
          analysis?.risk?.spread_radius_km ?? spreadRadius
        }
        waterRisk={analysis?.water_contamination ?? waterRisk}
        loading={analysisLoading}
        onAnalyze={handleAnalyze}
      />

      {/* ── Charts Dashboard ───────────────────────────────────────── */}
      <ChartsDashboard
        hourlyData={weather?.hourly ?? null}
        spreadProgression={
          prediction?.spread_model?.hourly_progression ?? []
        }
        riskScore={riskScore}
      />

      {/* ── Wildfire News ──────────────────────────────────────────── */}
      <WildfireNews />

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="footer">
        FireGuard XR — Immersive Wildfire Command Center &copy; 2025
      </footer>
    </div>
    </>
  );
}