import { useState } from "react";
import { analyzeFire } from "../../services/api";

export default function GeminiAssistant() {
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    setLoading(true);
    try {
      const result = await analyzeFire({
        temperature: 38,
        humidity: 12,
        wind_speed: 30,
        latitude: 49.28,
        longitude: -123.12,
      });
      setAdvice(result.ai_advice);
    } catch {
      setAdvice("Failed to get AI advice. Check backend connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 16,
        background: "#1e293b",
        borderRadius: 12,
        marginTop: 16,
      }}
    >
      <h3>🤖 Gemini AI Assistant</h3>
      <button
        onClick={handleAsk}
        disabled={loading}
        style={{
          padding: "8px 16px",
          borderRadius: 6,
          border: "none",
          background: "#2563eb",
          color: "white",
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        {loading ? "Thinking..." : "Ask Gemini for Analysis"}
      </button>
      {advice && (
        <p style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>{advice}</p>
      )}
    </div>
  );
}