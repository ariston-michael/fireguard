import { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import WildfireScene from "../xr/WildfireScene";

/* Fix default Leaflet marker icon in bundlers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ── helper: re-centre the map when coordinates change ──────────────── */
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  const prev = useRef(center);
  useEffect(() => {
    if (prev.current[0] !== center[0] || prev.current[1] !== center[1]) {
      map.flyTo(center, 11, { duration: 1.5 });
      prev.current = center;
    }
  }, [center, map]);
  return null;
}

/* ── Force Leaflet to recalculate size on mount ─────────────────────── */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Wait for container to finalize layout, then invalidate
    const timer = setTimeout(() => map.invalidateSize(), 200);
    const obs = new ResizeObserver(() => map.invalidateSize());
    if (map.getContainer()) obs.observe(map.getContainer());
    return () => {
      clearTimeout(timer);
      obs.disconnect();
    };
  }, [map]);
  return null;
}

/* ── Fire marker icon ───────────────────────────────────────────────── */
const fireIcon = new L.DivIcon({
  html: '<span style="font-size:24px">🔥</span>',
  className: "fire-marker",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/* ── Component ───────────────────────────────────────────────────────── */

/* ── Click-to-select location on map ─────────────────────────────────── */
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface MapPanelProps {
  center: [number, number];
  spreadRadiusKm: number;
  riskLevel: string;
  detectionTimestamp: string | null;
  fireDirection: string;
  windDirection: number;
  onMapClick?: (lat: number, lng: number) => void;
  threats?: { latitude: number; longitude: number; severity: string; radius_km: number }[];
}

export default function MapPanel({
  center,
  spreadRadiusKm,
  riskLevel,
  detectionTimestamp,
  fireDirection,
  windDirection,
  onMapClick,
  threats = [],
}: MapPanelProps) {
  const [leftFull, setLeftFull] = useState(false);
  const [rightFull, setRightFull] = useState(false);

  const riskColor =
    riskLevel === "Extreme"
      ? "#ef4444"
      : riskLevel === "High"
        ? "#f97316"
        : riskLevel === "Medium"
          ? "#eab308"
          : "#22c55e";

  /* Use real threat positions from the /threats endpoint */
  const fireMarkers: [number, number][] = useMemo(() => {
    return threats.map((t) => [t.latitude, t.longitude] as [number, number]);
  }, [threats]);

  return (
    <div className="map-section">
      <div className="map-panel-container">
        {/* ── Left: 3D Wildfire Simulation ──────────────────────────── */}
        <div
          className={`map-pane glass-card ${leftFull ? "map-fullscreen" : ""} ${rightFull ? "map-hidden" : ""}`}
        >
          <div className="map-pane-header">
            <span>3D Wildfire Simulation</span>
            <div className="map-controls">
              <button
                className="map-ctrl-btn"
                onClick={() => setLeftFull(!leftFull)}
                title={leftFull ? "Exit fullscreen" : "Fullscreen"}
              >
                {leftFull ? "⊖" : "⊕"}
              </button>
            </div>
          </div>
          <div className="map-pane-body">
            <WildfireScene
              spreadRadius={spreadRadiusKm}
              windDirection={windDirection}
              riskLevel={riskLevel}
            />
          </div>
        </div>

        {/* ── Right: Leaflet Map ────────────────────────────────────── */}
        <div
          className={`map-pane glass-card ${rightFull ? "map-fullscreen" : ""} ${leftFull ? "map-hidden" : ""}`}
        >
          <div className="map-pane-header">
            <span>Evacuation & Fire Map</span>
            <div className="map-controls">
              <button
                className="map-ctrl-btn"
                onClick={() => setRightFull(!rightFull)}
                title={rightFull ? "Exit fullscreen" : "Fullscreen"}
              >
                {rightFull ? "⊖" : "⊕"}
              </button>
            </div>
          </div>
          <div className="map-pane-body leaflet-pane-body">
            <MapContainer
              center={center}
              zoom={11}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%", minHeight: "420px" }}
            >
              <MapUpdater center={center} />
              <MapResizer />
              <MapClickHandler onMapClick={onMapClick} />
              <TileLayer
                attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Origin marker */}
              <Marker position={center}>
                <Popup>
                  <strong>Fire Origin</strong>
                  <br />
                  Risk: {riskLevel} | Spread: {spreadRadiusKm} km
                </Popup>
              </Marker>
              {/* Spread radius circle */}
              {/* Spread radius circle */}
              {spreadRadiusKm > 0 && (
                <Circle
                  center={center}
                  radius={spreadRadiusKm * 1000}
                  pathOptions={{
                    color: riskColor,
                    fillColor: riskColor,
                    fillOpacity: 0.25,
                    weight: 3,
                    dashArray: "8 4",
                  }}
                />
              )}
              {/* Simulated fire markers */}
              {fireMarkers.map((pos, i) => (
                <Marker key={i} position={pos} icon={fireIcon}>
                  <Popup>Active fire area {i + 1}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* ── Controls strip below maps ──────────────────────────────── */}
      <div className="map-info-strip glass-card">
        <div className="info-chip">
          <div className="chip-text">
            <span className="chip-label">Risk</span>
            <span className="chip-value" style={{ color: riskColor }}>{riskLevel}</span>
          </div>
        </div>
        <div className="info-chip">
          <div className="chip-text">
            <span className="chip-label">Fire Direction</span>
            <span className="chip-value">{fireDirection || "N/A"}</span>
          </div>
        </div>
        <div className="info-chip">
          <div className="chip-text">
            <span className="chip-label">Spread Radius</span>
            <span className="chip-value">{spreadRadiusKm} km</span>
          </div>
        </div>
        {detectionTimestamp && (
          <div className="info-chip">
            <div className="chip-text">
              <span className="chip-label">Detected</span>
              <span className="chip-value">
                {new Date(detectionTimestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
