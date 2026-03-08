import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { HourlyData, SpreadProgression } from "../../services/api";

interface ChartsDashboardProps {
  hourlyData: HourlyData | null;
  spreadProgression: SpreadProgression[];
  riskScore: number;
}

function formatTime(t: string): string {
  const d = new Date(t);
  return d.getHours().toString().padStart(2, "0") + ":00";
}

export default function ChartsDashboard({
  hourlyData,
  spreadProgression,
}: ChartsDashboardProps) {
  // Build chart data from hourly weather
  const weatherData = hourlyData
    ? hourlyData.time.map((t, i) => ({
        time: formatTime(t),
        temperature: hourlyData.temperature[i],
        humidity: hourlyData.humidity[i],
        windSpeed: hourlyData.wind_speed[i],
      }))
    : [];

  // Spread progression data
  const spreadData = spreadProgression.map((s) => ({
    hour: `+${s.hour}h`,
    radius: s.radius_km,
    area: s.area_km2,
  }));

  // Risk history derived from real hourly weather data (not random)
  const riskHistory = weatherData.length > 0
    ? weatherData.filter((_, i) => i % 2 === 0).map((d) => {
        // Compute risk score from real hourly conditions
        let score = 0;
        if (d.temperature > 30) score += 3;
        else if (d.temperature > 25) score += 2;
        else if (d.temperature > 20) score += 1;
        if (d.humidity < 20) score += 3;
        else if (d.humidity < 35) score += 2;
        else if (d.humidity < 50) score += 1;
        if (d.windSpeed > 30) score += 2;
        else if (d.windSpeed > 15) score += 1;
        return { time: d.time, risk: Math.min(8, score) };
      })
    : [];

  return (
    <div className="charts-dashboard">
      <h2 className="charts-title">Analytics Dashboard</h2>

      <div className="charts-grid">
        {/* Temperature Chart */}
        <div className="chart-card">
          <h3>Temperature (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={11}
                interval={3}
              />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Humidity Chart */}
        <div className="chart-card">
          <h3>Humidity (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={11}
                interval={3}
              />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
              />
              <Area
                type="monotone"
                dataKey="humidity"
                stroke="#3b82f6"
                fill="#3b82f644"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Wind Speed Chart */}
        <div className="chart-card">
          <h3>Wind Speed (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={11}
                interval={3}
              />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
              />
              <Line
                type="monotone"
                dataKey="windSpeed"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fire Spread Prediction */}
        <div className="chart-card">
          <h3>Predicted Fire Spread</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={spreadData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
              />
              <Bar dataKey="area" fill="#ef444488" name="Area (km²)" />
              <Bar dataKey="radius" fill="#f9731688" name="Radius (km)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Level Over Time */}
        <div className="chart-card">
          <h3>Wildfire Risk Level (24h History)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={riskHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 8]} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
              />
              <Area
                type="monotone"
                dataKey="risk"
                stroke="#ef4444"
                fill="#ef444433"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
