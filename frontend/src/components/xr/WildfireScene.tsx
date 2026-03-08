import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

interface WildfireSceneProps {
  spreadRadius: number;
  windDirection?: number;
  riskLevel?: string;
}

/* ── Noise helper (value noise for terrain) ─────────────────────────── */
function hashNoise(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hashNoise(ix, iz), b = hashNoise(ix + 1, iz);
  const c = hashNoise(ix, iz + 1), d = hashNoise(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x: number, z: number, octaves = 5): number {
  let v = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    v += smoothNoise(x * freq, z * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / total;
}

/* height at (x,z) — reused for tree placement */
function terrainHeight(x: number, z: number): number {
  const h =
    fbm(x * 0.06, z * 0.06, 5) * 6 +      // large mountains
    fbm(x * 0.15, z * 0.15, 3) * 2 +       // rolling hills
    Math.sin(x * 0.08) * Math.cos(z * 0.06) * 3 + // valleys
    fbm(x * 0.4, z * 0.4, 2) * 0.5;        // micro detail
  return h - 3;
}

/* ── Mountainous terrain ────────────────────────────────────────────── */
function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(80, 80, 160, 160);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = terrainHeight(x, y);
      pos.setZ(i, h);

      // Color by elevation: dark valleys → green slopes → rocky peaks
      const t = (h + 4) / 10; // normalize
      let r: number, gg: number, b: number;
      if (t < 0.25) {
        // Deep valley — dark earth
        r = 0.08; gg = 0.14; b = 0.06;
      } else if (t < 0.5) {
        // Forest floor — dark green
        r = 0.07 + t * 0.1; gg = 0.2 + t * 0.15; b = 0.05;
      } else if (t < 0.75) {
        // Mid slope — lighter green/brown
        r = 0.12 + t * 0.1; gg = 0.22 + t * 0.08; b = 0.08;
      } else {
        // Ridge / peak — rocky grey-brown
        r = 0.25; gg = 0.22; b = 0.18;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = gg;
      colors[i * 3 + 2] = b;
    }
    g.computeVertexNormals();
    const ca = new THREE.BufferAttribute(colors, 3);
    g.setAttribute("color", ca);
    return g;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} geometry={geo}>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0.05}
      />
    </mesh>
  );
}

/* ── Dense forest with varied trees ─────────────────────────────────── */
function Trees() {
  const trees = useMemo(() => {
    const pts: { pos: [number, number, number]; scale: number; type: number }[] = [];
    const rng = (seed: number) => {
      const s = Math.sin(seed) * 43758.5453;
      return s - Math.floor(s);
    };
    for (let i = 0; i < 200; i++) {
      const x = (rng(i * 1.17) - 0.5) * 60;
      const z = (rng(i * 2.31 + 7) - 0.5) * 60;
      const dist = Math.sqrt(x * x + z * z);
      if (dist > 6 && dist < 30) {
        const h = terrainHeight(x, z);
        const s = 0.5 + rng(i * 3.77) * 1.0;
        pts.push({ pos: [x, h + s * 1.2, z], scale: s, type: i % 3 });
      }
    }
    return pts;
  }, []);

  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={t.pos} scale={t.scale}>
          {/* Trunk */}
          <mesh position={[0, -0.8, 0]}>
            <cylinderGeometry args={[0.06, 0.12, 1.8, 5]} />
            <meshStandardMaterial color="#3b2112" roughness={0.95} />
          </mesh>
          {/* Canopy layers */}
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.7, 1.8, 6]} />
            <meshStandardMaterial
              color={t.type === 0 ? "#0f4f0f" : t.type === 1 ? "#1a5c1a" : "#145214"}
              roughness={0.85}
            />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <coneGeometry args={[0.5, 1.3, 6]} />
            <meshStandardMaterial
              color={t.type === 0 ? "#126612" : "#185a18"}
              roughness={0.85}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ── Burning trees near fire zone ───────────────────────────────────── */
function BurningTrees({ radius }: { radius: number }) {
  const trees = useMemo(() => {
    const pts: { pos: [number, number, number]; phase: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const r = radius * 0.4 + (i % 3) * radius * 0.15;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const h = terrainHeight(x, z);
      pts.push({ pos: [x, h + 0.8, z], phase: i * 0.5 });
    }
    return pts;
  }, [radius]);

  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={t.pos}>
          {/* Charred trunk */}
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.09, 1.2, 5]} />
            <meshStandardMaterial color="#1a0a00" roughness={1} />
          </mesh>
          {/* Burning canopy */}
          <BurningCanopy phase={t.phase} />
        </group>
      ))}
    </>
  );
}

function BurningCanopy({ phase }: { phase: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime + phase;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(t * 5) * 0.8;
      ref.current.scale.setScalar(0.8 + Math.sin(t * 3) * 0.15);
    }
  });
  return (
    <mesh ref={ref} position={[0, 0.3, 0]}>
      <coneGeometry args={[0.5, 1.2, 6]} />
      <meshStandardMaterial
        color="#3d1200"
        emissive="#ff3300"
        emissiveIntensity={2}
        roughness={0.9}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

/* ── Individual fire particle ──────────────────────────────────────── */
function FireNode({
  position,
  intensity,
}: {
  position: [number, number, number];
  intensity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime;
      const s = 1 + Math.sin(t * 4 + offset) * 0.4;
      ref.current.scale.set(s * intensity, s * 1.3 * intensity, s * intensity);
      ref.current.position.y =
        position[1] + Math.sin(t * 3 + offset) * 0.15;
    }
  });

  // Color changes based on intensity
  const color = intensity > 0.8 ? "#ff2200" : intensity > 0.5 ? "#ff4500" : "#ff8c00";
  const emissive = intensity > 0.8 ? "#ff0000" : "#ff3300";

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={2.5 * intensity}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

/* ── Fire spread zone with inner/outer ring ────────────────────────── */
function FireSpread({
  radius,
  windDir,
}: {
  radius: number;
  windDir: number;
}) {
  const nodes = useMemo(() => {
    const pts: { pos: [number, number, number]; intensity: number }[] = [];
    const count = Math.max(8, Math.floor(radius * 5));

    // Outer ring — higher intensity in wind direction
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const windRad = (windDir * Math.PI) / 180;
      const windFactor =
        1 + 0.6 * Math.max(0, Math.cos(angle - windRad));
      const r = (0.5 + 0.5 * windFactor) * radius;
      const intensity = 0.4 + 0.6 * windFactor;
      pts.push({
        pos: [Math.cos(angle) * r, 0.4, Math.sin(angle) * r],
        intensity: Math.min(1, intensity),
      });
    }

    // Inner core — hottest
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.4;
      pts.push({
        pos: [Math.cos(angle) * r, 0.6 + Math.random() * 0.3, Math.sin(angle) * r],
        intensity: 0.9 + Math.random() * 0.1,
      });
    }
    return pts;
  }, [radius, windDir]);

  return (
    <>
      {nodes.map((n, i) => (
        <FireNode key={i} position={n.pos} intensity={n.intensity} />
      ))}
    </>
  );
}

/* ── Heat haze ring on ground ──────────────────────────────────────── */
function HeatRing({ radius, riskLevel }: { radius: number; riskLevel: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.08 + Math.sin(clock.elapsedTime * 1.5) * 0.04;
    }
  });

  const color =
    riskLevel === "Extreme"
      ? "#ff0000"
      : riskLevel === "High"
        ? "#ff6600"
        : "#ff9900";

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[radius * 0.7, radius * 1.1, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1}
        transparent
        opacity={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Wind direction arrow (aligned with fire spread) ───────────────── */
function WindArrow({ windDir, radius }: { windDir: number; radius: number }) {
  const windRad = (windDir * Math.PI) / 180;
  const arrowLen = Math.max(3, radius * 0.8);

  // Position matches FireSpread convention: cos for X, sin for Z
  const x = Math.cos(windRad) * (radius + 2);
  const z = Math.sin(windRad) * (radius + 2);
  const y = terrainHeight(x, z) + 1.5;

  // Arrow points in +Z locally; rotate so +Z aligns with (cos(windRad), 0, sin(windRad))
  const yRotation = Math.PI / 2 - windRad;

  return (
    <group position={[x, y, z]} rotation={[0, yRotation, 0]}>
      {/* Shaft along +Z */}
      <mesh position={[0, 0, arrowLen / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, arrowLen, 8]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Arrowhead pointing +Z */}
      <mesh position={[0, 0, arrowLen]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 8]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={1}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Label */}
      <Text
        position={[0, 0.8, arrowLen + 0.4]}
        fontSize={0.5}
        color="#06b6d4"
        anchorX="center"
        anchorY="bottom"
      >
        WIND
      </Text>
    </group>
  );
}

/* ── Volumetric smoke plumes ───────────────────────────────────────── */
function SmokeCloud({ radius }: { radius: number }) {
  const count = 8;
  const puffs = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * radius * 1.5,
      z: (Math.random() - 0.5) * radius * 1.5,
      size: radius * 0.3 + Math.random() * radius * 0.4,
      speed: 0.2 + Math.random() * 0.3,
      phase: i * 0.8,
    })),
    [radius]
  );

  return (
    <>
      {puffs.map((p, i) => (
        <SmokePuff key={i} {...p} />
      ))}
    </>
  );
}

function SmokePuff({ x, z, size, speed, phase }: {
  x: number; z: number; size: number; speed: number; phase: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime * speed + phase;
      ref.current.position.y = 5 + Math.sin(t * 0.5) * 2 + (t * 0.2 % 4);
      ref.current.rotation.y = t * 0.1;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.06 + Math.sin(t * 0.8) * 0.03;
    }
  });

  return (
    <mesh ref={ref} position={[x, 5, z]}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial
        color="#2a2a2a"
        transparent
        opacity={0.08}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ── Embers (tiny floating particles) ──────────────────────────────── */
function Embers({ radius }: { radius: number }) {
  const count = Math.min(30, Math.max(8, Math.floor(radius * 3)));
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * radius * 2,
      z: (Math.random() - 0.5) * radius * 2,
      speed: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [radius, count]);

  return (
    <>
      {particles.map((p, i) => (
        <EmberParticle key={i} x={p.x} z={p.z} speed={p.speed} phase={p.phase} />
      ))}
    </>
  );
}

function EmberParticle({
  x,
  z,
  speed,
  phase,
}: {
  x: number;
  z: number;
  speed: number;
  phase: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime * speed + phase;
      ref.current.position.y = 1 + ((t * 0.5) % 5);
      ref.current.position.x = x + Math.sin(t * 2) * 0.3;
      ref.current.position.z = z + Math.cos(t * 1.5) * 0.3;
      const life = 1 - ((t * 0.5) % 5) / 5;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = life * 0.9;
    }
  });

  return (
    <mesh ref={ref} position={[x, 1, z]}>
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshStandardMaterial
        color="#ffaa00"
        emissive="#ff6600"
        emissiveIntensity={3}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

/* ── Main scene ────────────────────────────────────────────────────── */
export default function WildfireScene({
  spreadRadius,
  windDirection = 180,
  riskLevel = "Medium",
}: WildfireSceneProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "460px",
        borderRadius: 0,
        overflow: "hidden",
      }}
    >
      <Canvas camera={{ position: [18, 14, 18], fov: 50 }}>
        {/* Dark moody sky */}
        <color attach="background" args={["#060810"]} />
        <fog attach="fog" args={["#0a0810", 20, 70]} />

        {/* Lighting — dramatic fire-lit atmosphere */}
        <ambientLight intensity={0.15} color="#4466aa" />
        <directionalLight
          position={[10, 20, 8]}
          intensity={0.3}
          color="#ffeedd"
          castShadow
        />
        <hemisphereLight
          color="#1a2244"
          groundColor="#331100"
          intensity={0.2}
        />

        {/* Fire glow lights — multiple for realistic illumination */}
        <pointLight position={[0, 5, 0]} color="#ff4500" intensity={5} distance={35} decay={2} />
        <pointLight position={[0, 2, 0]} color="#ff8c00" intensity={4} distance={25} decay={2} />
        <pointLight
          position={[
            Math.cos((windDirection * Math.PI) / 180) * spreadRadius * 0.5,
            3,
            Math.sin((windDirection * Math.PI) / 180) * spreadRadius * 0.5,
          ]}
          color="#ff2200"
          intensity={3}
          distance={20}
        />
        {/* Rim light from fire reflecting off smoke */}
        <pointLight position={[0, 8, 0]} color="#ff6600" intensity={1.5} distance={40} decay={2} />

        <Terrain />
        <Trees />
        <BurningTrees radius={spreadRadius} />
        <FireSpread radius={spreadRadius} windDir={windDirection} />
        <HeatRing radius={spreadRadius} riskLevel={riskLevel} />
        <WindArrow windDir={windDirection} radius={spreadRadius} />
        <SmokeCloud radius={spreadRadius} />
        <Embers radius={spreadRadius} />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={50}
          autoRotate
          autoRotateSpeed={0.2}
        />
      </Canvas>
    </div>
  );
}