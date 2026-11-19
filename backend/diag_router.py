
"""
backend/diag_router.py
FastAPI router exposing the diagnostics module to the frontend / operators.
 
    GET /api/diagnostics/health   -> LED report {overall, checks[]}
    GET /api/diagnostics/logs     -> last N structured log events (?limit=50)
    GET /api/diagnostics/codes    -> error-code reference table
"""
from fastapi import APIRouter
 
from backend import diagnostics as diag
 
router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])
 
 
@router.get("/health")
def health():
    return diag.run_self_test()
 
 
@router.get("/logs")
def logs(limit: int = 50):
    return diag.tail(max(1, min(limit, 500)))
 
 
@router.get("/codes")
def codes():
    return {c: {"title": t, "action": a} for c, (t, a) in diag.ERROR_CODES.items()}
 