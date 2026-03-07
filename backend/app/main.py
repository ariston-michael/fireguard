from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.wildfire import router as wildfire_router

app = FastAPI(
    title="FireGuard XR API",
    description="Immersive Wildfire Command Center - Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wildfire_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "FireGuard XR API running"}
