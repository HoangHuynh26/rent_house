from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.analyze import router as analyze_router

app = FastAPI(
    title="Local AI Meter Reading Service",
    version="1.0.0",
    description="Self-hosted local computer vision & OCR service for rental meter analysis without external APIs."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "ai-meter-reader",
        "engine": "OpenCV / Local Vision OCR",
        "external_apis": "NONE (100% self-hosted)"
    }

app.include_router(analyze_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
