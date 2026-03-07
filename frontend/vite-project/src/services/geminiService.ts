export async function askGemini(prompt:string){

 const res = await fetch("/api/gemini",{
  method:"POST",
  body:JSON.stringify({prompt})
 })

 return res.json()
}