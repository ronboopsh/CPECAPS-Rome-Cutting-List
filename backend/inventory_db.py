"""
==============================================================================
REMNANT & STOCK SHEET INVENTORY DATABASE (`backend/inventory_db.py`)
Owner: Benjamin Torres
Rome Cabinets - Automated Cutting List & Shop-Floor Coordinator
==============================================================================
Manages full stock sheets and remnant scrap pieces. Enforces hard constraints
for remnant scrap matching:
  1. Exact thickness match (H == part.thickness)
  2. Exact material match (material == part.material)
  3. Dimensions >= part dimensions + saw kerf (default kerf = 3.2 mm)
  4. Area utilization >= 70.0%
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional


DEFAULT_SAW_KERF_MM: float = 3.2
MIN_REMNANT_UTILIZATION_PCT: float = 70.0

INITIAL_STOCK_AND_SCRAP: List[Dict[str, Any]] = [
    {
        "id": "sheet-1",
        "num": "1",
        "type": "STOCK",
        "l": 2440.0,
        "w": 1220.0,
        "h": 18.0,
        "material": "18mm Marine Plywood",
        "used_percent": 82.0,
    },
    {
        "id": "sheet-2",
        "num": "2",
        "type": "STOCK",
        "l": 2440.0,
        "w": 1220.0,
        "h": 18.0,
        "material": "Plywood",
        "used_percent": 78.0,
    },
    {
        "id": "sheet-3",
        "num": "3",
        "type": "STOCK",
        "l": 2440.0,
        "w": 1220.0,
        "h": 18.0,
        "material": "MDF",
        "used_percent": 76.0,
    },
    {
        "id": "remnant-101",
        "num": "R1",
        "type": "REMNANT",
        "l": 800.0,
        "w": 520.0,
        "h": 18.0,
        "material": "18mm Marine Plywood",
        "used_percent": 0.0,
    },
    {
        "id": "remnant-102",
        "num": "R2",
        "type": "REMNANT",
        "l": 640.0,
        "w": 510.0,
        "h": 18.0,
        "material": "MDF",
        "used_percent": 0.0,
    },
]


def get_inventory_items() -> List[Dict[str, Any]]:
    """Returns all stock sheets and remnant scrap items."""
    return list(INITIAL_STOCK_AND_SCRAP)


def match_remnant_scrap(
    part: Dict[str, Any],
    inventory: Optional[List[Dict[str, Any]]] = None,
    kerf_mm: float = DEFAULT_SAW_KERF_MM,
    min_utilization_pct: float = MIN_REMNANT_UTILIZATION_PCT,
) -> Dict[str, Any]:
    """
    Evaluates available remnant scrap pieces against a requested cabinet part
    using the 4 hard constraints from PROJECT_CONTEXT.md:
      - Exact thickness match
      - Exact material match
      - Scrap L >= Part L + kerf and Scrap W >= Part W + kerf
      - Area utilization >= 70%
    """
    if inventory is None:
        inventory = INITIAL_STOCK_AND_SCRAP

    part_l = float(part.get("l", part.get("length", 0.0)))
    part_w = float(part.get("w", part.get("width", 0.0)))
    part_h = float(part.get("h", part.get("thickness", 18.0)))
    part_mat = str(part.get("material", "")).strip().lower()
    part_area = part_l * part_w

    candidates: List[Dict[str, Any]] = []
    for item in inventory:
        if item.get("type") != "REMNANT":
            continue
        if abs(float(item["h"]) - part_h) > 0.01:
            continue
        if str(item["material"]).strip().lower() != part_mat:
            continue

        req_l = part_l + kerf_mm
        req_w = part_w + kerf_mm
        fits_normal = float(item["l"]) >= req_l and float(item["w"]) >= req_w
        fits_rotated = float(item["w"]) >= req_l and float(item["l"]) >= req_w
        if not (fits_normal or fits_rotated):
            continue

        scrap_area = float(item["l"]) * float(item["w"])
        utilization_pct = (part_area / scrap_area) * 100.0 if scrap_area > 0 else 0.0
        if utilization_pct >= min_utilization_pct:
            candidates.append(
                {
                    "remnant_id": item["id"],
                    "remnant_dimensions": f"{item['l']:.0f}x{item['w']:.0f}x{item['h']:.0f}mm",
                    "material": item["material"],
                    "utilization_pct": round(utilization_pct, 2),
                }
            )

    candidates.sort(key=lambda c: -c["utilization_pct"])
    return {
        "matched": len(candidates) > 0,
        "best_match": candidates[0] if candidates else None,
        "viable_remnants": candidates,
    }
