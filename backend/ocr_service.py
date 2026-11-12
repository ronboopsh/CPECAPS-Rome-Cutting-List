"""
Simple OCR for paper cutting lists (Rome Cabinets).

What it does, in order:
  1. Cleans up the photo (grayscale, upscale, denoise, straighten, threshold).
  2. Reads the text with an OCR engine (EasyOCR if installed, else Tesseract).
     The engine returns words with a position and a confidence.
  3. Groups words that sit on the same horizontal line into rows.
  4. Turns each row into a part: name, qty, L, W, thickness, material.
  5. Gives each field a confidence (0-1); the review modal highlights < 0.8.

It does not invent data: if nothing can be read, it returns zero rows.
"""
from __future__ import annotations

import base64
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

try:
    import pytesseract  # type: ignore
    HAS_TESSERACT = True
except Exception:  # pragma: no cover
    pytesseract = None
    HAS_TESSERACT = False

try:
    import easyocr  # type: ignore
    HAS_EASYOCR = True
except Exception:  # pragma: no cover
    easyocr = None
    HAS_EASYOCR = False

CONFIDENCE_THRESHOLD = 0.80
_EASY_READER = None

MATERIALS = [
    (r"marine|mar\.?\s*ply", "18mm Marine Plywood"),
    (r"ply", "Plywood"),
    (r"mdf", "MDF"),
    (r"melamine|mela", "Melamine"),
    (r"particle|chipboard|pb\b", "Particle Board"),
    (r"hdf", "HDF"),
]
HEADER_WORDS = {"part", "name", "qty", "quantity", "length", "width", "thk",
                "thickness", "material", "no", "item", "description", "pcs"}


# --------------------------------------------------------------------------
# 1. Image cleanup
# --------------------------------------------------------------------------
def preprocess(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    h, w = gray.shape
    if max(h, w) < 2000:  # small photos OCR badly; upscale
        s = 2000 / max(h, w)
        gray = cv2.resize(gray, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    gray = _deskew(gray)
    # even out shadows, then binarize
    bg = cv2.medianBlur(gray, 51)
    norm = cv2.divide(gray, bg, scale=255)
    _, bw = cv2.threshold(norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bw


def _deskew(gray: np.ndarray) -> np.ndarray:
    inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    pts = cv2.findNonZero(inv)
    if pts is None:
        return gray
    angle = cv2.minAreaRect(pts)[-1]
    if angle > 45:
        angle -= 90
    if abs(angle) < 0.3 or abs(angle) > 15:
        return gray
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)


# --------------------------------------------------------------------------
# 2. OCR engines -> list of words: {text, conf (0-1), x, y, w, h}
# --------------------------------------------------------------------------
def read_words(img: np.ndarray) -> Tuple[List[Dict[str, Any]], str]:
    if HAS_EASYOCR:
        global _EASY_READER
        if _EASY_READER is None:
            _EASY_READER = easyocr.Reader(["en"], gpu=False, verbose=False)
        words = []
        for box, text, conf in _EASY_READER.readtext(img):
            xs = [p[0] for p in box]; ys = [p[1] for p in box]
            words.append({"text": text, "conf": float(conf), "x": min(xs),
                          "y": min(ys), "w": max(xs) - min(xs),
                          "h": max(ys) - min(ys)})
        return words, "easyocr"
    if HAS_TESSERACT:
        d = pytesseract.image_to_data(img, config="--psm 6",
                                      output_type=pytesseract.Output.DICT)
        words = []
        for i, t in enumerate(d["text"]):
            t = t.strip()
            if t and float(d["conf"][i]) >= 0:
                words.append({"text": t, "conf": float(d["conf"][i]) / 100,
                              "x": d["left"][i], "y": d["top"][i],
                              "w": d["width"][i], "h": d["height"][i]})
        return words, "tesseract"
    raise RuntimeError("No OCR engine available. Install easyocr or pytesseract.")


# --------------------------------------------------------------------------
# 3. Words -> text rows
# --------------------------------------------------------------------------
def group_rows(words: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    if not words:
        return []
    med_h = float(np.median([w["h"] for w in words])) or 10.0
    rows: List[List[Dict[str, Any]]] = []
    for w in sorted(words, key=lambda w: w["y"] + w["h"] / 2):
        cy = w["y"] + w["h"] / 2
        if rows and abs(cy - np.mean([r["y"] + r["h"] / 2 for r in rows[-1]])) < med_h * 0.6:
            rows[-1].append(w)
        else:
            rows.append([w])
    return [sorted(r, key=lambda w: w["x"]) for r in rows]


# --------------------------------------------------------------------------
# 4. Row -> part
# --------------------------------------------------------------------------
_NUM = re.compile(r"\d+(?:[.,]\d+)?")


def _fix_digits(t: str) -> str:
    """Common OCR mix-ups inside number-like tokens (O->0, l->1, S->5 ...)."""
    if re.fullmatch(r"[0-9OolI|SsBZ.,xX*×]+", t) and re.search(r"\d", t):
        return t.translate(str.maketrans("OolI|SsBZ", "001115582"))
    return t


def parse_row(row: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    toks = []
    for w in row:
        # split things like "720x560x18" into separate pieces
        for piece in re.split(r"[xX×*]", _fix_digits(w["text"])):
            if piece.strip():
                toks.append((piece.strip(), w["conf"]))
    if not toks or {t.lower().strip(":.") for t, _ in toks} & HEADER_WORDS and \
            not any(_NUM.fullmatch(t) for t, _ in toks):
        return None

    name_parts, nums, mat_text, name_conf = [], [], [], []
    for t, c in toks:
        if _NUM.fullmatch(t):
            nums.append((float(t.replace(",", ".")), c))
        elif any(re.search(p, t, re.I) for p, _ in MATERIALS):
            mat_text.append((t, c))
        elif not nums and re.search(r"[A-Za-z]", t):
            name_parts.append(t); name_conf.append(c)
        elif nums and re.fullmatch(r"(mm|pcs|pc)\.?", t, re.I):
            continue
        elif nums and re.search(r"[A-Za-z]", t) and len(nums) >= 2:
            mat_text.append((t, c))
    if len(nums) < 2 or not name_parts:
        return None

    vals = [v for v, _ in nums]; cfs = [c for _, c in nums]
    # Layouts: qty L W T | qty L W | L W T | L W
    if len(vals) >= 4:
        qi, li, wi, ti = 0, 1, 2, 3
    elif len(vals) == 3 and vals[0] <= 50 and vals[1] > 50:
        qi, li, wi, ti = 0, 1, 2, None
    elif len(vals) == 3:
        qi, li, wi, ti = None, 0, 1, 2
    else:
        qi, li, wi, ti = None, 0, 1, None

    get = lambda i, d: (vals[i], cfs[i]) if i is not None else (d, 0.6)
    qty, qc = get(qi, 1); L, lc = get(li, 0); W, wc = get(wi, 0); T, tc = get(ti, 18)

    material = None
    mtext = " ".join(t for t, _ in mat_text)
    for pat, name in MATERIALS:
        if re.search(pat, mtext, re.I):
            material = name; break
    mc = float(np.mean([c for _, c in mat_text])) if mat_text else 0.6

    # Sanity checks -> lower confidence of suspicious cells
    if qty != int(qty) or not (1 <= qty <= 100): qc = min(qc, 0.5)
    if not (30 <= L <= 3000): lc = min(lc, 0.5)
    if not (30 <= W <= 3000): wc = min(wc, 0.5)
    if T not in (3, 4, 6, 9, 12, 15, 16, 18, 20, 25): tc = min(tc, 0.5)
    if W > L: pass  # allowed, user decides

    nc = float(np.mean(name_conf)) if name_conf else 0.5
    conf = {"part_name": nc, "quantity": qc, "length": lc, "width": wc,
            "thickness": tc, "material": mc}
    return {
        "part_name": " ".join(name_parts), "part": " ".join(name_parts),
        "quantity": int(qty), "qty": int(qty),
        "length": L, "l": L, "width": W, "w": W,
        "thickness": T, "h": T,
        "material": material or "18mm Marine Plywood",
        "corner": "None", "source_jobs": ["OCR Scan"],
        "confidence": round(min(conf.values()), 3),
        **{f"{k}_confidence": round(v, 3) for k, v in conf.items()},
    }


# --------------------------------------------------------------------------
# 5. Public entry point
# --------------------------------------------------------------------------
def process_ocr_sheet(image_path: str, project_id: str = "job-ocr-default") -> Dict[str, Any]:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Could not read the image file.")
    clean = preprocess(img)
    words, engine = read_words(clean)
    parts = []
    for i, row in enumerate(group_rows(words)):
        p = parse_row(row)
        if p:
            p["id"] = f"ocr-{len(parts) + 1}"
            parts.append(p)

    ok, buf = cv2.imencode(".jpg", img if max(img.shape[:2]) < 1600 else
                           cv2.resize(img, None, fx=1600 / max(img.shape[:2]),
                                      fy=1600 / max(img.shape[:2])))
    preview = "data:image/jpeg;base64," + base64.b64encode(buf).decode() if ok else None
    flagged = sum(1 for p in parts for k in ("part_name", "quantity", "length", "width", "thickness")
                  if p[f"{k}_confidence"] < CONFIDENCE_THRESHOLD)
    return {"status": "ok", "engine": engine, "project_id": project_id,
            "parts": parts, "rows": parts, "flagged_cells": flagged,
            "imageUrl": preview}


# Backwards-compatible name used by tests/benchmark_suite.py
def extract_cutlist_from_image(image_path: str, *_, **__) -> Dict[str, Any]:
    return process_ocr_sheet(image_path)
