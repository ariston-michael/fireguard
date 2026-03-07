export async function uploadImage(file:File){

 const form = new FormData()
 form.append("file",file)

 return fetch("https://api.cloudinary.com/v1_1/demo/upload",{
  method:"POST",
  body:form
 })
}