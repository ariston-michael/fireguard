import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface EvacuationMapProps {
  center?: [number, number];
  spreadRadiusKm?: number;
  riskLevel?: string;
}

export default function EvacuationMap({
  center = [49.28, -123.12],
  spreadRadiusKm = 7.5,
  riskLevel = "High",
}: EvacuationMapProps) {
  const color =
    riskLevel === "Extreme"
      ? "red"
      : riskLevel === "High"
      ? "orange"
      : riskLevel === "Medium"
      ? "yellow"
      : "green";

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", marginTop: 16 }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "400px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center}>
          <Popup>
            Wildfire Origin - Risk: {riskLevel} - Spread: {spreadRadiusKm} km
          </Popup>
        </Marker>
        <Circle
          center={center}
          radius={spreadRadiusKm * 1000}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.15,
          }}
        />
      </MapContainer>
    </div>
  );
}