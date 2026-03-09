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
  aqi: number | null;
  aqiCategory: string;
  aqiHealth: string;
  confidence: number;
}

export default function MetricsCards({
  temperature,
  humidity,
  windSpeed,
  riskLevel,
  riskScore,
  spreadRadius,
  waterRisk,
  aqi,
  aqiCategory,
  aqiHealth,
  confidence,
}: MetricsCardsProps) {
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
        sub={`Score ${riskScore}/10 · ${spreadRadius} km radius`}
      />
      <MetricCard
        label="Air Quality"
        value={aqi !== null ? aqi : "--"}
        sub={aqi !== null ? `${aqiCategory} · ${aqiHealth}` : "Loading..."}
      />
      <MetricCard
        label="Prediction Confidence"
        value={confidence}
        unit="%"
        sub={waterRisk !== "Low" ? `Water risk: ${waterRisk}` : "Model accuracy"}
      />
    </div>
  );
}
