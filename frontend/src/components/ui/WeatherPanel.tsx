interface WeatherPanelProps {
  temperature: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  weatherCode: number | null;
  isDay: number | null;
  locationName: string;
}

function weatherDescription(code: number | null): string {
  if (code === null) return "Loading...";
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

function weatherIcon(code: number | null, isDay: number | null): string {
  if (code === null) return "🌐";
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 3) return isDay ? "⛅" : "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

function windArrow(dir: number | null): string {
  if (dir === null) return "";
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  return arrows[Math.round(dir / 45) % 8];
}

export default function WeatherPanel({
  temperature,
  windSpeed,
  windDirection,
  weatherCode,
  isDay,
  locationName,
}: WeatherPanelProps) {
  return (
    <div className="weather-panel">
      <div className="weather-main">
        <span className="weather-icon">
          {weatherIcon(weatherCode, isDay)}
        </span>
        <div className="weather-temp">
          <span className="temp-value">
            {temperature !== null ? `${temperature}°C` : "--"}
          </span>
          <span className="weather-desc">
            {weatherDescription(weatherCode)}
          </span>
        </div>
      </div>
      <div className="weather-details">
        <span>
          {windSpeed ?? "--"} km/h {windArrow(windDirection)}
        </span>
        <span className="weather-location" title={locationName}>
          {locationName.length > 30 ? locationName.slice(0, 30) + "..." : locationName}
        </span>
      </div>
    </div>
  );
}
