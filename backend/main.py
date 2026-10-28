"""
backend/main.py
FastAPI Application & API Gateway for Rome Cabinets Shop-Floor Coordinator.
"""

from typing import List, Optional
import os
import shutil
import uuid
from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import partner backend services
from backend.cad_parser import parse_cad_file
from backend.ocr_service import process_ocr_sheet
from backend.aggregator import aggregate_projects
from backend.inventory_db import get_inventory_stock, match_remnants

app = FastAPI(
    title="Rome Cabinets API Gateway",
    version="1.0.0",
    description="Shop-Floor Coordinator API for CAD ingestion, OCR cutlist review, aggregation, and remnant matching."
)

# Enable CORS for Vite frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_UPLOAD_DIR = "/tmp/rome_uploads"
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

# ----------------- Data Models -----------------

class PartEntity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    part_name: str
    quantity: int
    length: float
    width: float
    thickness: float
    material: str
    corner_cut: str = "None"
    source: str = "CAD"  # "CAD" | "OCR"
    confidence: Optional[float] = 1.0
    remarks: Optional[str] = ""
    source_jobs: Optional[List[str]] = None

class OcrReviewCommitRequest(BaseModel):
    project_id: str
    parts: List[PartEntity]

class AggregateRequest(BaseModel):
    project_ids: List[str]

class RemnantMatchRequest(BaseModel):
    parts: List[PartEntity]
    min_utilization: float = 0.70  # Hard constraint: >= 70% scrap utilization

# ----------------- Endpoints -----------------

@app.get("/health")
def health_check():
    return {"status": "online", "system": "Rome Cabinets Shop-Floor Coordinator"}

@app.post("/api/upload-cad", response_model=List[PartEntity])
async def upload_cad(file: UploadFile = File(...), project_id: str = "job-cad-default"):
    """
    Ingests .dae, .obj, or .csv cutlists.
    Halts with 422 if model contains non-manifold or 0-thickness geometry.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".dae", ".obj", ".csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported CAD format: {ext}. Permitted formats are .dae, .obj, and .csv."
        )

    temp_path = os.path.join(TEMP_UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        parsed_parts = parse_cad_file(temp_path, project_id=project_id)
        return parsed_parts
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"CAD ingestion error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/upload-ocr")
async def upload_ocr(file: UploadFile = File(...), project_id: str = "job-ocr-default"):
    """
    Ingests .png or .jpg photos of physical paper cutlists.
    Runs OpenCV grid detection + EasyOCR and returns parts with cell confidence scores.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image format: {ext}. Permitted formats are .png and .jpg."
        )

    temp_path = os.path.join(TEMP_UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Returns extracted row parts + image URL / base64 for side-by-side preview
        ocr_result = process_ocr_sheet(temp_path, project_id=project_id)
        return ocr_result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"OCR pipeline error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/ocr/commit", response_model=List[PartEntity])
async def commit_ocr_review(payload: OcrReviewCommitRequest):
    """
    Commits reviewed & human-corrected OCR parts into the working session database.
    """
    for part in payload.parts:
        part.source = "OCR"
        part.confidence = 1.0  # Certified 100% post-human review
    return payload.parts

@app.post("/api/aggregate", response_model=List[PartEntity])
async def aggregate(payload: AggregateRequest):
    """
    Consolidates identical parts across multiple jobs and sorts by:
    Material -> Thickness -> Width (Descending) for repetitive rip-cutting.
    """
    if not payload.project_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No project IDs supplied for aggregation.")
    try:
        consolidated_parts = aggregate_projects(payload.project_ids)
        return consolidated_parts
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Aggregation error: {str(e)}")

@app.get("/api/inventory")
def fetch_inventory():
    """Returns available full sheets and remnant scrap stock."""
    return get_inventory_stock()

@app.post("/api/inventory/match")
def match_inventory_scraps(payload: RemnantMatchRequest):
    """
    Matches parts against remnant scrap pieces:
    Constraints: Exact material, exact thickness, scrap dims >= part + kerf, area utilization >= 70%.
    """
    parts_data = [p.dict() for p in payload.parts]
    matches = match_remnants(parts_data, min_utilization=payload.min_utilization)
    return matches
