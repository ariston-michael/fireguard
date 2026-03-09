export async function askGemini(prompt: string) {
  const res = await fetch("/api/analyze-fire", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      temperature: 35,
      humidity: 15,
      wind_speed: 25,
      latitude: 49.28,
      longitude: -123.12,
    }),
  });
  return res.json();
}
