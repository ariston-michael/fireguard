import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface WildfireSceneProps {
  spreadRadius: number;
}

function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[50, 50, 64, 64]} />
      <meshStandardMaterial color="#2d5016" roughness={1} />
    </mesh>
  );
}

function Trees() {
  const positions: [number, number, number][] = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      if (Math.sqrt(x * x + z * z) > 8) {
        pts.push([x, 1.5, z]);
      }
    }
    return pts;
  }, []);

  return (
    <>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh position={[0, -1, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 2, 8]} />
            <meshStandardMaterial color="#5c3317" />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[1, 2.5, 8]} />
            <meshStandardMaterial color="#1a5c1a" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function FireNode({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 4 + position[0] * 2) * 0.35;
      ref.current.scale.set(s, s * 1.2, s);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#ff4500"
        emissive="#ff2200"
        emissiveIntensity={2}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function FireSpread({ radius }: { radius: number }) {
  const nodes = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = Math.max(6, Math.floor(radius * 4));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (Math.random() * 0.5 + 0.5) * radius;
      pts.push([Math.cos(angle) * r, 0.4, Math.sin(angle) * r]);
    }
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.5;
      pts.push([Math.cos(angle) * r, 0.6, Math.sin(angle) * r]);
    }
    return pts;
  }, [radius]);

  return (
    <>
      {nodes.map((pos, i) => (
        <FireNode key={i} position={pos} />
      ))}
    </>
  );
}

function SmokeCloud({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 3 + Math.sin(clock.elapsedTime * 0.5) * 0.5;
      ref.current.rotation.y = clock.elapsedTime * 0.2;
    }
  });

  return (
    <mesh ref={ref} position={[0, 3, 0]}>
      <sphereGeometry args={[radius * 0.8, 16, 16]} />
      <meshStandardMaterial color="#555555" transparent opacity={0.15} />
    </mesh>
  );
}

export default function WildfireScene({ spreadRadius }: WildfireSceneProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "500px",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #334155",
      }}
    >
      <Canvas camera={{ position: [12, 10, 12], fov: 50 }}>
        <color attach="background" args={["#0c0c1a"]} />
        <fog attach="fog" args={["#0c0c1a", 20, 50]} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <pointLight position={[0, 3, 0]} color="#ff4500" intensity={3} distance={25} />
        <pointLight position={[0, 1, 0]} color="#ff8c00" intensity={2} distance={15} />
        <Terrain />
        <Trees />
        <FireSpread radius={spreadRadius} />
        <SmokeCloud radius={spreadRadius} />
        <OrbitControls enablePan={true} enableZoom={true} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}