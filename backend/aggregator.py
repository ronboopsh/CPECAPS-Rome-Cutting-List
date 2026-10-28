"""
==============================================================================
MODULE 1: MULTI-PROJECT CUTLIST AGGREGATOR & SAW-SETUP RIP SORTER (PYTHON)
Rome Cabinets - Automated Cutting List & Shop-Floor Coordinator
==============================================================================
Combines multiple cabinet cutlist schedules (e.g., Job #1: Galvez Kitchen,
Job #2: Wardrobe Unit, Job #3: Drawer Bank), merges identical parts matching
(material, thickness H, width W, length L), retains source_jobs metadata,
and implements the Table Saw Rip Sorter (grouped by Material & Thickness H,
sorted descending by Width W ↓ then Length L ↓).
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import copy
import json


DEFAULT_PROJECT_SCHEDULES: Dict[str, List[Dict[str, Any]]] = {
    "Job #1": [
        {
            "id": 101,
            "part": "Side Panel",
            "qty": 2,
            "l": 750.0,
            "w": 500.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #1"],
        },
        {
            "id": 102,
            "part": "Base Shelf",
            "qty": 2,
            "l": 564.0,
            "w": 480.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #1"],
        },
        {
            "id": 103,
            "part": "Adjustable Shelf",
            "qty": 1,
            "l": 564.0,
            "w": 480.0,
            "h": 18.0,
            "corner": "None",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #1"],
        },
        {
            "id": 104,
            "part": "Top Stretcher",
            "qty": 2,
            "l": 564.0,
            "w": 100.0,
            "h": 18.0,
            "corner": "None",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #1"],
        },
        {
            "id": 105,
            "part": "Cabinet Door Slab",
            "qty": 2,
            "l": 746.0,
            "w": 296.0,
            "h": 18.0,
            "corner": "Edge 2x",
            "material": "MDF",
            "source_jobs": ["Job #1"],
        },
        {
            "id": 106,
            "part": "Top Panel",
            "qty": 1,
            "l": 600.0,
            "w": 500.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "MDF",
            "source_jobs": ["Job #1"],
        },
    ],
    "Job #2": [
        {
            "id": 201,
            "part": "Side Panel",
            "qty": 2,
            "l": 750.0,
            "w": 500.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #2"],
        },
        {
            "id": 202,
            "part": "Wardrobe Tall Gable",
            "qty": 2,
            "l": 2100.0,
            "w": 600.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #2"],
        },
        {
            "id": 203,
            "part": "Fixed Shelf",
            "qty": 3,
            "l": 564.0,
            "w": 480.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #2"],
        },
        {
            "id": 204,
            "part": "Top Panel",
            "qty": 2,
            "l": 600.0,
            "w": 500.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "MDF",
            "source_jobs": ["Job #2"],
        },
        {
            "id": 205,
            "part": "Valance Rail",
            "qty": 2,
            "l": 864.0,
            "w": 100.0,
            "h": 18.0,
            "corner": "None",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #2"],
        },
    ],
    "Job #3": [
        {
            "id": 301,
            "part": "Side Panel",
            "qty": 2,
            "l": 750.0,
            "w": 500.0,
            "h": 18.0,
            "corner": "Edge 1x",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #3"],
        },
        {
            "id": 302,
            "part": "Drawer Box Side",
            "qty": 6,
            "l": 450.0,
            "w": 160.0,
            "h": 18.0,
            "corner": "None",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #3"],
        },
        {
            "id": 303,
            "part": "Drawer Front Face",
            "qty": 3,
            "l": 746.0,
            "w": 296.0,
            "h": 18.0,
            "corner": "Edge 2x",
            "material": "MDF",
            "source_jobs": ["Job #3"],
        },
        {
            "id": 304,
            "part": "Stretcher Rail",
            "qty": 4,
            "l": 564.0,
            "w": 100.0,
            "h": 18.0,
            "corner": "None",
            "material": "18mm Marine Plywood",
            "source_jobs": ["Job #3"],
        },
    ],
}


def get_part_identity_key(part: Dict[str, Any]) -> Tuple[str, float, float, float]:
    """
    Returns the composite identity tuple (material_normalized, h, w, l)
    used to detect identical components across project cutlists.
    """
    material = str(part.get("material", "MDF")).strip().lower()
    h = round(float(part.get("h", 18.0)), 2)
    w = round(float(part.get("w", 0.0)), 2)
    l = round(float(part.get("l", 0.0)), 2)
    return (material, h, w, l)


def aggregate_project_schedules(
    schedules: Dict[str, List[Dict[str, Any]]],
    selected_jobs: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Combines multiple project schedules, detects identical parts matching
    (material, thickness H, width W, length L), merges quantities, and retains
    `source_jobs` tracking metadata.
    """
    if selected_jobs is None:
        selected_jobs = list(schedules.keys())

    merged_map: Dict[Tuple[str, float, float, float], Dict[str, Any]] = {}
    raw_row_count = 0

    for job_name in selected_jobs:
        job_parts = schedules.get(job_name, [])
        for part in job_parts:
            raw_row_count += 1
            key = get_part_identity_key(part)
            qty = int(part.get("qty", 1))
            src_jobs = list(part.get("source_jobs") or [job_name])
            if job_name not in src_jobs:
                src_jobs.append(job_name)

            if key not in merged_map:
                entry = copy.deepcopy(part)
                entry["qty"] = qty
                entry["l"] = float(part.get("l", 0.0))
                entry["w"] = float(part.get("w", 0.0))
                entry["h"] = float(part.get("h", 18.0))
                entry["source_jobs"] = src_jobs
                entry["merged_count"] = 1
                merged_map[key] = entry
            else:
                existing = merged_map[key]
                existing["qty"] += qty
                existing["merged_count"] += 1
                for j in src_jobs:
                    if j not in existing["source_jobs"]:
                        existing["source_jobs"].append(j)
                if existing.get("corner") == "None" and part.get("corner") not in (None, "None"):
                    existing["corner"] = part["corner"]

    consolidated_list: List[Dict[str, Any]] = []
    for idx, item in enumerate(merged_map.values(), start=1):
        item["num"] = f"#{idx}"
        item["consolidated"] = item["merged_count"] > 1 or len(item["source_jobs"]) > 1
        consolidated_list.append(item)

    return {
        "parts": consolidated_list,
        "stats": {
            "raw_rows": raw_row_count,
            "consolidated_rows": len(consolidated_list),
            "duplicates_merged": max(0, raw_row_count - len(consolidated_list)),
            "total_pieces": sum(int(p.get("qty", 1)) for p in consolidated_list),
        },
    }


def sort_for_table_saw_rip_cuts(parts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Dedicated Table Saw Rip Sorter:
    1. Groups parts by Material and Thickness (e.g., 18mm Marine Plywood).
    2. Sorts parts descending by Width (W ↓) then Length (L ↓) so carpenters
       can make repetitive rip cuts without moving the table saw fence.
    """
    sorted_parts = sorted(
        copy.deepcopy(parts),
        key=lambda p: (
            str(p.get("material", "")).strip().lower(),
            -float(p.get("h", 18.0)),
            -float(p.get("w", 0.0)),
            -float(p.get("l", 0.0)),
        ),
    )

    fence_groups: Dict[str, List[Dict[str, Any]]] = {}
    unique_fence_setups = set()

    for idx, p in enumerate(sorted_parts, start=1):
        p["num"] = f"#{idx}"
        mat_group_key = f"{p.get('material', 'MDF')} ({int(float(p.get('h', 18)))}mm)"
        fence_key = f"{mat_group_key} :: W={float(p.get('w', 0)):.0f}mm"
        unique_fence_setups.add(fence_key)
        p["rip_setup_group"] = fence_key
        fence_groups.setdefault(mat_group_key, []).append(p)

    return {
        "parts": sorted_parts,
        "material_groups": fence_groups,
        "unique_fence_setups": len(unique_fence_setups),
    }


def parse_cad_schedule_payload(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Pre-check geometry sanitizer & CAD component parser for .dae / .obj / .csv
    mesh bounding boxes. Raises ValueError on malformed geometry (zero/negative
    bounding volumes, NaN vertices, or non-manifold negative thickness).
    """
    if not isinstance(payload, dict) or "components" not in payload:
        raise ValueError("Malformed CAD payload: missing 'components' root node.")

    components = payload["components"]
    if not isinstance(components, list) or len(components) == 0:
        raise ValueError("Malformed CAD payload: empty component list.")

    parsed_parts: List[Dict[str, Any]] = []
    for idx, comp in enumerate(components, start=1):
        l_val = float(comp.get("l", 0.0))
        w_val = float(comp.get("w", 0.0))
        h_val = float(comp.get("h", 0.0))
        if l_val <= 0 or w_val <= 0 or h_val <= 0:
            raise ValueError(
                f"Pre-check geometry sanitizer halted parsing: component #{idx} "
                f"has invalid/non-positive dimensions ({l_val} x {w_val} x {h_val})."
            )
        if comp.get("corrupted_normals") or comp.get("non_manifold"):
            raise ValueError(
                f"Pre-check geometry sanitizer halted parsing: component #{idx} "
                f"contains non-manifold mesh topology."
            )

        dims = sorted([l_val, w_val, h_val], reverse=True)
        parsed_parts.append(
            {
                "id": comp.get("id", idx),
                "num": f"#{idx}",
                "part": str(comp.get("part", f"Panel_{idx}")),
                "qty": int(comp.get("qty", 1)),
                "l": round(dims[0], 2),
                "w": round(dims[1], 2),
                "h": round(dims[2], 2),
                "corner": str(comp.get("corner", "None")),
                "material": str(comp.get("material", "18mm Marine Plywood")),
                "source_jobs": list(comp.get("source_jobs", ["Job #1"])),
            }
        )
    return parsed_parts


if __name__ == "__main__":
    agg = aggregate_project_schedules(DEFAULT_PROJECT_SCHEDULES)
    rip = sort_for_table_saw_rip_cuts(agg["parts"])
    print("=" * 78)
    print("ROME CABINETS - MULTI-PROJECT CUTLIST AGGREGATOR & RIP SORTER")
    print("=" * 78)
    print(
        f"Raw Rows: {agg['stats']['raw_rows']} | "
        f"Consolidated Rows: {agg['stats']['consolidated_rows']} | "
        f"Total Pieces: {agg['stats']['total_pieces']} | "
        f"Unique Fence Setups: {rip['unique_fence_setups']}"
    )
    print("-" * 78)
    for row in rip["parts"]:
        jobs_str = ", ".join(row["source_jobs"])
        print(
            f"{row['num']:>3} | {row['part']:<20} | Qty: {row['qty']:>2} | "
            f"{row['l']:>6.0f} x {row['w']:>5.0f} x {row['h']:>2.0f} mm | "
            f"{row['material']:<20} | [{jobs_str}]"
        )
