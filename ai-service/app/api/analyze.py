import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image
import numpy as np
from app.image_processing.quality import analyze_image_quality
from app.ocr.meter_reader import extract_meter_digits

router = APIRouter()

@router.post("/analyze-meter")
async def analyze_meter(
    file: UploadFile = File(...),
    reading_type: str = Form("electricity"),
    previous_value: float = Form(None)
):
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
        img_np = np.array(image)

        # 1. Quality Analysis
        quality = analyze_image_quality(img_np)

        # 2. OCR Digit Recognition
        ocr_result = extract_meter_digits(img_np, reading_type, previous_value)

        # Combine warnings
        all_warnings = list(set(quality["warnings"] + ocr_result["warnings"]))

        # Composite validity
        is_valid = quality["is_valid"] and ocr_result["confidence"] >= 0.70

        return {
            "success": True,
            "data": {
                "value": ocr_result["value"],
                "confidence": ocr_result["confidence"],
                "image_quality": quality["image_quality_score"],
                "blur_score": quality["blur_score"],
                "brightness_score": quality["brightness_score"],
                "resolution": quality["resolution"],
                "is_blurry": quality["is_blurry"],
                "is_dark": quality["is_dark"],
                "is_overexposed": quality["is_overexposed"],
                "has_glare": quality["has_glare"],
                "is_valid": is_valid,
                "warnings": all_warnings,
                "model_name": "Local-Vision-FastAPI-v1.0"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")
