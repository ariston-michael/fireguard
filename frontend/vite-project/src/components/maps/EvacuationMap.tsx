import { MapContainer, TileLayer, Marker } from "react-leaflet"

export default function EvacuationMap(){
 return(
  <MapContainer center={[49.28,-123.12]} zoom={10} style={{height:"400px"}}>
   <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
   <Marker position={[49.28,-123.12]}/>
  </MapContainer>
 )
}