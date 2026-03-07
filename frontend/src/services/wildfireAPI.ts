export async function fetchWildfireRisk(
  temperature: number,
  humidity: number,
  windSpeed: number
) {
  const params = new URLSearchParams({
    temperature: String(temperature),
    humidity: String(humidity),
    wind_speed: String(windSpeed),
  });
  const res = await fetch("/api/wildfire-risk?" + params);
  return res.json();
}
