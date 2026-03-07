import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"

function Fire() {
  return (
    <mesh position={[0,1,0]}>
      <sphereGeometry args={[1,32,32]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}

export default function WildfireScene() {
  return (
    <Canvas camera={{position:[5,5,5]}}>
      <ambientLight />
      <Fire/>
      <OrbitControls/>
    </Canvas>
  )
}