"""
==============================================================================
FASTAPI APPLICATION & ROUTE GATEWAY (`backend/main.py`)
Owner: Pamela Calma
Rome Cabinets - Automated Cutting List & Shop-Floor Coordinator
==============================================================================
Implements the canonical REST API endpoints specified in PROJECT_CONTEXT.md:
  - POST /api/upload-cad
  - POST /api/upload-ocr
  - POST /api/aggregate
  - GET  /api/inventory
  - POST /api/inventory/match
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.aggregator import (
    DEFAULT_PROJECT_SCHEDULES,
    aggregate_project_schedules,
    sort_for_table_saw_rip_cuts,
)
from backend.cad_parser import parse_cad_payload
from backend.inventory_db import get_inventory_items, match_remnant_scrap
from backend.ocr_service import extract_cutlist_from_image

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    HAS_FASTAPI = True
except BaseException:
    FastAPI = None  # type: ignore
    HAS_FASTAPI = False


if HAS_FASTAPI:
    app = FastAPI(
        title="Rome Cabinets — Automated Cutting List & Shop-Floor Coordinator API",
        version="2.5.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/api/upload-cad")
    def api_upload_cad(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            parts = parse_cad_payload(payload)
            return {"status": "ok", "count": len(parts), "parts": parts}
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @app.post("/api/upload-ocr")
    def api_upload_ocr(payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        image_path = (payload or {}).get("image_path", "sample_workshop_sheet.jpg")
        sheet_id = (payload or {}).get("sheet_id")
        return extract_cutlist_from_image(image_path=image_path, sheet_id=sheet_id)

    @app.post("/api/aggregate")
    def api_aggregate(payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        project_ids: Optional[List[str]] = (payload or {}).get("project_ids")
        agg = aggregate_project_schedules(DEFAULT_PROJECT_SCHEDULES, selected_jobs=project_ids)
        rip = sort_for_table_saw_rip_cuts(agg["parts"])
        return {
            "status": "ok",
            "parts": rip["parts"],
            "stats": agg["stats"],
            "unique_fence_setups": rip["unique_fence_setups"],
        }

    @app.get("/api/inventory")
    def api_get_inventory() -> Dict[str, Any]:
        items = get_inventory_items()
        return {"status": "ok", "items": items}

    @app.post("/api/inventory/match")
    def api_match_inventory(part: Dict[str, Any]) -> Dict[str, Any]:
        return match_remnant_scrap(part)


if __name__ == "__main__":
    print("=" * 78)
    print("ROME CABINETS — BACKEND SERVICE HEALTH CHECK")
    print("=" * 78)
    agg_res = aggregate_project_schedules(DEFAULT_PROJECT_SCHEDULES)
    rip_res = sort_for_table_saw_rip_cuts(agg_res["parts"])
    match_res = match_remnant_scrap(rip_res["parts"][1])
    print(f"Consolidated Parts Ready : {len(rip_res['parts'])} unique rows")
    print(f"Table Saw Fence Setups   : {rip_res['unique_fence_setups']} setups")
    print(f"Remnant Scrap Match Test : {match_res['best_match']}")
    print("=" * 78)
