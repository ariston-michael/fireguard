export async function uploadImageToCloudinary(imageUrl: string) {
  const res = await fetch("/api/upload-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
  });
  return res.json();
}
