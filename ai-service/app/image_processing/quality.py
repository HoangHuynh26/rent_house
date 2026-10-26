import numpy as np

def analyze_image_quality(img: np.ndarray) -> dict:
    """
    Analyzes visual quality of meter photo:
    - Blur via Laplacian variance
    - Darkness / Brightness via histogram luminance
    - Glare / Overexposure via saturation threshold
    - Resolution constraints
    """
    h, w = img.shape[:2]
    
    # 1. Resolution Check
    is_low_res = (w < 400 or h < 300)
    
    # Grayscale conversion if 3-channel
    if len(img.shape) == 3 and img.shape[2] == 3:
        # standard RGB to Grayscale weights
        gray = np.dot(img[..., :3], [0.2989, 0.5870, 0.1140]).astype(np.float32)
    else:
        gray = img.astype(np.float32)

    # 2. Brightness & Darkness check
    mean_brightness = float(np.mean(gray))
    is_dark = mean_brightness < 45.0
    is_overexposed = mean_brightness > 220.0
    
    # 3. Glare Check
    glare_pixels = np.sum(gray > 245.0)
    total_pixels = h * w
    glare_ratio = float(glare_pixels / max(1, total_pixels))
    has_glare = glare_ratio > 0.15

    # 4. Blur Detection (Laplacian Approximation via 2D convolution kernel)
    # Kernel: [[0, 1, 0], [1, -4, 1], [0, 1, 0]]
    if h > 2 and w > 2:
        top = gray[:-2, 1:-1]
        bottom = gray[2:, 1:-1]
        left = gray[1:-1, :-2]
        right = gray[1:-1, 2:]
        center = gray[1:-1, 1:-1]
        laplacian = top + bottom + left + right - (4.0 * center)
        blur_score = float(np.var(laplacian))
    else:
        blur_score = 0.0

    is_blurry = blur_score < 100.0

    # 5. Composite Quality Score [0.0, 1.0]
    # Penalize based on blur, lighting deviation from ideal (128)
    brightness_penalty = abs(mean_brightness - 128.0) / 128.0
    blur_factor = min(1.0, blur_score / 300.0)
    
    raw_quality = (blur_factor * 0.6) + ((1.0 - brightness_penalty) * 0.4)
    if is_low_res:
        raw_quality *= 0.7
    if has_glare:
        raw_quality *= 0.8
        
    quality_score = max(0.1, min(0.99, float(raw_quality)))

    warnings = []
    if is_blurry:
        warnings.append("Ảnh bị mờ. Vui lòng giữ chắc tay và lấy nét vào mặt số đồng hồ.")
    if is_dark:
        warnings.append("Ảnh quá tối. Vui lòng bật đèn flash hoặc chụp ở nơi đủ sáng.")
    if is_overexposed or has_glare:
        warnings.append("Ảnh bị chói lóa ánh sáng lên mặt kính đồng hồ. Vui lòng đổi góc chụp nghiêng.")
    if is_low_res:
        warnings.append("Độ phân giải ảnh quá thấp.")

    return {
        "blur_score": round(blur_score, 2),
        "brightness_score": round(mean_brightness, 2),
        "is_blurry": is_blurry,
        "is_dark": is_dark,
        "is_overexposed": is_overexposed,
        "has_glare": has_glare,
        "is_low_res": is_low_res,
        "resolution": f"{w}x{h}",
        "image_quality_score": round(quality_score, 4),
        "is_valid": (not is_blurry and not is_dark and not has_glare and not is_low_res),
        "warnings": warnings
    }
