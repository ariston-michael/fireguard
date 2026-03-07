import { useMemo } from "react";
interface FireSpreadSimulationProps {
  windSpeed: number;
  temperature: number;
}

export default function FireSpreadSimulation({
  windSpeed,
  temperature,
}: FireSpreadSimulationProps) {
  const fires = useMemo(() => {
    const nodes = [];
    const count = Math.max(5, Math.floor(windSpeed * 0.5));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = windSpeed * 0.2 * (0.5 + Math.random() * 0.5);
      nodes.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        intensity: temperature > 30 ? 1.0 : 0.6,
      });
    }
    return nodes;
  }, [windSpeed, temperature]);

  return (
    <>
      {fires.map((f, i) => (
        <mesh key={i} position={[f.x, 0.5, f.z]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial
            color="red"
            emissive="orange"
            emissiveIntensity={f.intensity * 2}
          />
        </mesh>
      ))}
    </>
  );
}
