interface EvacuationOverlayProps {
  riskLevel: string;
  spreadRadius: number;
}

export default function EvacuationOverlay({
  riskLevel,
  spreadRadius,
}: EvacuationOverlayProps) {
  const color =
    riskLevel === "Extreme"
      ? "#ef4444"
      : riskLevel === "High"
      ? "#f97316"
      : riskLevel === "Medium"
      ? "#eab308"
      : "#22c55e";

  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[spreadRadius - 0.2, spreadRadius + 0.2, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}
