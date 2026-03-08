import type { ForecastDay, ForecastRiskDay } from "../../services/api";

interface ForecastPanelProps {
  forecast: ForecastDay[];
  riskForecast: ForecastRiskDay[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

function riskColor(level: string): string {
  if (level === "Extreme") return "#ef4444";
  if (level === "High") return "#f97316";
  if (level === "Medium") return "#eab308";
  return "#22c55e";
}

export default function ForecastPanel({
  forecast,
  riskForecast,
}: ForecastPanelProps) {
  if (!forecast.length) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="forecast-section">
      <h2 className="forecast-title">7-Day Forecast & Fire Risk</h2>
      <div className="forecast-grid">
        {forecast.map((day, i) => {
          const d = new Date(day.date + "T12:00:00");
          const dayName = day.date === today ? "Today" : DAY_NAMES[d.getDay()];
          const risk = riskForecast[i];
          const riskScore = risk?.risk_score ?? 0;
          const riskLvl = risk?.risk_level ?? "Low";
          const color = riskColor(riskLvl);

          return (
            <div
              key={day.date}
              className={`forecast-day ${day.date === today ? "today" : ""}`}
            >
              <div className="forecast-day-name">{dayName}</div>
              <div className="forecast-day-icon">
                {weatherIcon(day.weather_code)}
              </div>
              <div className="forecast-temps">
                <span className="forecast-high">
                  {Math.round(day.temp_max)}°
                </span>
                <span className="forecast-low">
                  {Math.round(day.temp_min)}°
                </span>
              </div>
              <div className="forecast-detail">
                {Math.round(day.wind_speed_max)} km/h
              </div>
              <div className="forecast-detail">
                {day.humidity_min}–{day.humidity_max}%
              </div>
              <div className="forecast-detail">
                {day.precipitation.toFixed(1)} mm
              </div>
              <div className="forecast-risk-bar">
                <div
                  className="forecast-risk-fill"
                  style={{
                    width: `${(riskScore / 8) * 100}%`,
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
              </div>
              <div
                className="forecast-detail"
                style={{ color, fontWeight: 600, marginTop: 4 }}
              >
                {riskLvl}
                {risk && ` · ${risk.spread_radius_km} km`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
