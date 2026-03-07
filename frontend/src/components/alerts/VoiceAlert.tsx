import { useState } from "react";
import { playVoiceAlert } from "../../services/api";

interface VoiceAlertProps {
  riskLevel?: string;
  spreadRadius?: number;
  waterRisk?: string;
}

export default function VoiceAlert({
  riskLevel = "High",
  spreadRadius = 7.5,
  waterRisk = "Medium",
}: VoiceAlertProps) {
  const [playing, setPlaying] = useState(false);

  async function handleSpeak() {
    setPlaying(true);
    const message =
      "Emergency wildfire alert. Risk level is " + riskLevel +
      ". Estimated fire spread radius is " + spreadRadius +
      " kilometers. Water contamination risk is " + waterRisk +
      ". Please follow evacuation routes immediately.";
    try {
      await playVoiceAlert(message);
    } catch {
      alert("Voice alert failed. Check ElevenLabs API key in backend/.env");
    } finally {
      setPlaying(false);
    }
  }

  return (
    <button
      onClick={handleSpeak}
      disabled={playing}
      style={{
        padding: "10px 20px",
        borderRadius: 8,
        border: "none",
        background: "#7c3aed",
        color: "white",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 15,
      }}
    >
      {playing ? "🔊 Speaking..." : "🔊 Voice Alert"}
    </button>
  );
}