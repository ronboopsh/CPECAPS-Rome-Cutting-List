
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
from backend.diagnostics import run_stage
from backend.diag_router import router as diagnostics_router
 
app = FastAPI(
    title="Rome Cabinets API Gateway",
    version="1.0.0",
    description="Shop-Floor Coordinator API for CAD ingestion, OCR cutlist review, aggregation, and remnant matching."
)
 
# Diagnostics: /api/diagnostics/health (status LEDs), /logs, /codes
app.include_router(diagnostics_router)
 
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
 
        parsed_parts = run_stage("cad", parse_cad_file, temp_path, project_id=project_id, timeout_s=5.0)
        return parsed_parts
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"[{getattr(e, 'rc_code', 'RC-999')}] {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"[{getattr(e, 'rc_code', 'RC-999')}] CAD ingestion error: {e}")
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
        ocr_result = run_stage("ocr", process_ocr_sheet, temp_path, project_id=project_id, timeout_s=30.0)
        return ocr_result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"[{getattr(e, 'rc_code', 'RC-999')}] OCR pipeline error: {e}")
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
        consolidated_parts = run_stage("aggregation", aggregate_projects, payload.project_ids, timeout_s=5.0)
        return consolidated_parts
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"[{getattr(e, 'rc_code', 'RC-999')}] Aggregation error: {e}")
 
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
    matches = run_stage("inventory", match_remnants, parts_data, min_utilization=payload.min_utilization, timeout_s=5.0)
    return matches
 