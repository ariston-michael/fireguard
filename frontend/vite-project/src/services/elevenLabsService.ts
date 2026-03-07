export async function speak(text:string){

 const res = await fetch("/api/voice",{
  method:"POST",
  body:JSON.stringify({text})
 })

 const audio = await res.blob()
 const url = URL.createObjectURL(audio)

 new Audio(url).play()
}