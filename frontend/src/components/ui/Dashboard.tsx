import { useState } from "react";
import WildfireScene from "../xr/WildfireScene";
import EvacuationMap from "../maps/EvacuationMap";
import GeminiAssistant from "../ai/GeminiAssistant";
import VoiceAlert from "../alerts/VoiceAlert";
import { analyzeFire, type AnalysisResponse } from "../../services/api";

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
      alert("Analysis failed. Is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
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
        FireGuard XR - Wildfire Command Center
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Immersive wildfire simulation and AI-powered risk analysis
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <label>
          Temp (C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Humidity (%)
          <input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(+e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Wind (km/h)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(+e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={btnStyle}>
          {loading ? "Analyzing..." : "Analyze Fire Risk"}
        </button>

        {result && (
          <VoiceAlert
            riskLevel={result.risk.level}
            spreadRadius={result.risk.spread_radius_km}
            waterRisk={result.water_contamination}
          />
        )}
      </div>

      <WildfireScene spreadRadius={result ? result.risk.spread_radius_km : 3} />

      <EvacuationMap
        spreadRadiusKm={result ? result.risk.spread_radius_km : 3}
        riskLevel={result ? result.risk.level : "Low"}
      />

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
          <p>Spread radius: {result.risk.spread_radius_km} km</p>
          <p>Water contamination risk: {result.water_contamination}</p>

          <h3 style={{ marginTop: 16 }}>AI Analysis (Gemini)</h3>
          <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>
            {result.ai_advice}
          </p>
        </div>
      )}

      <GeminiAssistant />
    </div>
  );
}