#!/usr/bin/env python3
"""Local PaddleOCR for long e-commerce banners. Prints JSON to stdout."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Windows CPU: disable OneDNN to avoid paddle 3.x crash
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from PIL import Image, ImageEnhance

MAX_WIDTH = 2400
MAX_TILE_HEIGHT = 2800
TILE_OVERLAP = 160
DEFAULT_UPSCALE_FACTOR = 2.0


def env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def preprocess_tile(img: Image.Image) -> Image.Image:
    """Boost contrast/sharpness so white copy survives steam/glare overlays."""
    contrast = env_float("OCR_CONTRAST", 1.35)
    sharpness = env_float("OCR_SHARPNESS", 1.5)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(sharpness)
    return img


def resolve_width(natural_width: int) -> tuple[int, bool]:
    factor = env_float("OCR_UPSCALE_FACTOR", DEFAULT_UPSCALE_FACTOR)
    if natural_width > MAX_WIDTH:
        return MAX_WIDTH, False
    boosted = min(MAX_WIDTH, round(natural_width * factor))
    if boosted > natural_width:
        return boosted, True
    return natural_width, False


def iter_tiles(image_path: Path) -> tuple[list[tuple[Image.Image, int]], int, int, bool]:
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        width, height = img.size

    target_w, upscaled = resolve_width(width)
    scale = target_w / width
    target_h = max(1, round(height * scale))
    resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    tiles: list[tuple[Image.Image, int]] = []
    stride = max(1, MAX_TILE_HEIGHT - TILE_OVERLAP)
    top = 0
    while top < target_h:
        tile_h = min(MAX_TILE_HEIGHT, target_h - top)
        tiles.append((resized.crop((0, top, target_w, top + tile_h)), top))
        if top + tile_h >= target_h:
            break
        top += stride

    return tiles, target_w, target_h, upscaled


def box_bounds(box) -> tuple[float, float, float, float]:
    if hasattr(box, "tolist"):
        box = box.tolist()
    if not isinstance(box, (list, tuple)) or len(box) < 4:
        return 0.0, 0.0, 0.0, 0.0
    xs: list[float] = []
    ys: list[float] = []
    for point in box[:4]:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            xs.append(float(point[0]))
            ys.append(float(point[1]))
        else:
            xs.append(float(point))
    if not xs:
        return 0.0, 0.0, 0.0, 0.0
    return min(xs), min(ys), max(xs), max(ys)


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: paddle_ocr_extract.py <image-path>", file=sys.stderr)
        return 2

    image_path = Path(sys.argv[1]).resolve()
    if not image_path.is_file():
        print(json.dumps({"error": f"file not found: {image_path}"}), file=sys.stderr)
        return 1

    import numpy as np
    from paddleocr import PaddleOCR

    lang = os.environ.get("PADDLE_OCR_LANG", "ch").strip() or "ch"
    ocr = PaddleOCR(use_textline_orientation=True, lang=lang, enable_mkldnn=False)
    tiles, width, height, upscaled = iter_tiles(image_path)

    segments: list[dict] = []
    seen: set[str] = set()
    ordered_lines: list[str] = []

    for tile_img, tile_top in tiles:
        result = ocr.predict(np.array(preprocess_tile(tile_img)))
        for block in result or []:
            if not isinstance(block, dict):
                continue
            texts = block.get("rec_texts") or []
            boxes = block.get("rec_boxes")
            if boxes is None:
                boxes = block.get("rec_polys")
            if boxes is None:
                boxes = []
            scores = block.get("rec_scores")
            if scores is None:
                scores = []
            for i, text in enumerate(texts):
                text = (text or "").strip()
                if not text or text in seen:
                    continue
                score = float(scores[i]) if i < len(scores) else 1.0
                if score < 0.62:
                    continue
                x0, y0, x1, y1 = 0.0, float(tile_top), 0.0, float(tile_top)
                if i < len(boxes):
                    bx0, by0, bx1, by1 = box_bounds(boxes[i])
                    x0, y0 = bx0, by0 + tile_top
                    x1, y1 = bx1, by1 + tile_top
                seen.add(text)
                segments.append(
                    {"text": text, "x0": x0, "y0": y0, "x1": x1, "y1": y1, "score": score}
                )
                ordered_lines.append(text)

    segments.sort(key=lambda s: (s["y0"], s["x0"]))
    ocr_text = "\n".join(seg["text"] for seg in segments).strip()

    payload = {
        "ocr_text": ocr_text,
        "provider": "paddleocr_local",
        "tile_count": len(tiles),
        "image_width": width,
        "image_height": height,
        "upscaled": upscaled,
        "segment_count": len(segments),
        "segments": [
            {"text": s["text"], "x0": s["x0"], "y0": s["y0"], "x1": s["x1"], "y1": s["y1"]}
            for s in segments
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if ocr_text else 1


if __name__ == "__main__":
    raise SystemExit(main())
