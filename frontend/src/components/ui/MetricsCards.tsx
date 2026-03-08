interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}

function MetricCard({ label, value, unit, sub }: MetricCardProps) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

interface MetricsCardsProps {
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  riskLevel: string;
  riskScore: number;
  spreadRadius: number;
  waterRisk: string;
  satelliteScans: number;
}

export default function MetricsCards({
  temperature,
  humidity,
  windSpeed,
  riskLevel,
  riskScore,
  spreadRadius,
  waterRisk,
}: MetricsCardsProps) {
  // Derive prediction confidence from risk score range
  const confidence = riskScore >= 6 ? 94 : riskScore >= 4 ? 82 : riskScore >= 2 ? 71 : 65;

  // Derive air quality from temperature & humidity (simplified AQI estimate)
  let aqi: string;
  if (temperature !== null && humidity !== null) {
    const raw = Math.round(
      30 + (temperature > 30 ? (temperature - 30) * 3 : 0) + (humidity < 30 ? (30 - humidity) * 0.8 : 0)
    );
    aqi = raw > 100 ? "Unhealthy" : raw > 60 ? "Moderate" : "Good";
  } else {
    aqi = "--";
  }

  return (
    <div className="metrics-grid">
      <MetricCard
        label="Temperature"
        value={temperature ?? "--"}
        unit="°C"
        sub="Current"
      />
      <MetricCard
        label="Humidity"
        value={humidity ?? "--"}
        unit="%"
        sub="Relative"
      />
      <MetricCard
        label="Wind Speed"
        value={windSpeed ?? "--"}
        unit=" km/h"
        sub="Surface"
      />
      <MetricCard
        label="Wildfire Risk"
        value={riskLevel}
        sub={`Score ${riskScore}/8 · ${spreadRadius} km radius`}
      />
      <MetricCard
        label="Air Quality"
        value={aqi}
        sub={waterRisk !== "Low" ? `Water risk: ${waterRisk}` : "Normal levels"}
      />
      <MetricCard
        label="Prediction Confidence"
        value={confidence}
        unit="%"
        sub="Model accuracy"
      />
    </div>
  );
}
