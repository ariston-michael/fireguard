import { useState } from "react";
import type { Threat } from "../../services/api";

interface ThreatDetectionProps {
  threats: Threat[];
  riskLevel: string;
  scanTime: string | null;
  scanning: boolean;
}

export default function SatelliteStatus({
  threats,
  riskLevel,
  scanTime,
  scanning,
}: ThreatDetectionProps) {
  const [expanded, setExpanded] = useState(false);

  const severityColor: Record<string, string> = {
    Critical: "#ef4444",
    High: "#f97316",
    Moderate: "#eab308",
    Low: "#22c55e",
  };

  const isAlert = threats.length > 0;

  return (
    <div className="satellite-panel">
      <div
        className="sat-clickable"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer" }}
      >
        <div className="sat-header">
          <span className={`sat-dot ${scanning ? "sat-active" : "sat-inactive"}`} />
          <span className="sat-title">Threat Detection</span>
          <span className={`sat-mode ${isAlert ? "sat-alert-mode" : ""}`}>
            {isAlert ? "ALERT" : "MONITORING"}
          </span>
        </div>
        <div className="sat-stats">
          <span>
            Detected threats:{" "}
            <strong style={{ color: isAlert ? "#ef4444" : "#22c55e" }}>
              {threats.length}
            </strong>
          </span>
          <span>
            Risk: <strong style={{ color: severityColor[riskLevel] || "#94a3b8" }}>{riskLevel}</strong>
          </span>
          <span>
            Last scan:{" "}
            <strong>
              {scanTime
                ? new Date(scanTime).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })
                : "—"}
            </strong>
          </span>
        </div>
        {scanning && (
          <div className="sat-bar-track">
            <div className="sat-bar-fill" />
          </div>
        )}
      </div>

      {expanded && threats.length > 0 && (
        <div className="threat-list">
          {threats.map((t) => (
            <div
              key={t.id}
              className="threat-item"
              style={{ borderLeftColor: severityColor[t.severity] || "#eab308" }}
            >
              <div className="threat-header">
                <span
                  className="threat-severity"
                  style={{ color: severityColor[t.severity] }}
                >
                  {t.severity}
                </span>
                <span className="threat-coords">
                  {t.latitude.toFixed(3)}, {t.longitude.toFixed(3)}
                </span>
              </div>
              <p className="threat-desc">{t.description}</p>
              <span className="threat-radius">Radius: {t.radius_km} km</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
