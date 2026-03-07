import cloudinary
import cloudinary.uploader
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


async def upload_image_url(image_url: str) -> dict:
    if not CLOUDINARY_CLOUD_NAME:
        raise ValueError("Cloudinary not configured. Set CLOUDINARY_* vars in backend/.env")
    result = cloudinary.uploader.upload(image_url, folder="fireguard-xr")
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "format": result.get("format"),
    }
