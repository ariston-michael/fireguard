const fires = []

for(let i=0;i<10;i++){
 fires.push(
  <mesh position={[i,1,i]}>
    <sphereGeometry args={[0.5,16,16]} />
    <meshStandardMaterial color="red"/>
  </mesh>
 )
}