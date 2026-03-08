import { useState } from "react";
import { playVoiceAlert } from "../../services/api";

interface AIAnalysisPanelProps {
  advice: string | null;
  riskLevel: string;
  spreadRadius: number;
  waterRisk: string;
  loading: boolean;
  onAnalyze: () => void;
}

export default function AIAnalysisPanel({
  advice,
  riskLevel,
  spreadRadius,
  waterRisk,
  loading,
  onAnalyze,
}: AIAnalysisPanelProps) {
  const [speaking, setSpeaking] = useState(false);

  async function handleVoice() {
    if (!advice) return;
    setSpeaking(true);
    const msg =
      `Emergency wildfire alert. Risk level is ${riskLevel}. ` +
      `Estimated fire spread radius is ${spreadRadius} kilometers. ` +
      `Water contamination risk is ${waterRisk}. ` +
      `Please follow evacuation routes immediately.`;
    try {
      await playVoiceAlert(msg);
    } catch {
      /* Voice unavailable — silently ignore */
    } finally {
      setSpeaking(false);
    }
  }

  const riskColor =
    riskLevel === "Extreme"
      ? "#ef4444"
      : riskLevel === "High"
        ? "#f97316"
        : riskLevel === "Medium"
          ? "#eab308"
          : "#22c55e";

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <h3>Gemini AI Analysis</h3>
        <div className="ai-actions">
          <button
            className="btn btn-primary"
            onClick={onAnalyze}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Analyze Fire Risk"}
          </button>
          {advice && (
            <button
              className="btn btn-voice"
              onClick={handleVoice}
              disabled={speaking}
            >
              {speaking ? "Speaking..." : "Voice Alert"}
            </button>
          )}
        </div>
      </div>

      {advice && (
        <div className="ai-result">
          <div className="ai-risk-badge" style={{ borderColor: riskColor }}>
            <span style={{ color: riskColor, fontWeight: 700, fontSize: 18 }}>
              {riskLevel}
            </span>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>
              Spread: {spreadRadius} km | Water: {waterRisk}
            </span>
          </div>
          <p className="ai-advice">{advice}</p>
        </div>
      )}
    </div>
  );
}
