"""
==============================================================================
CAD PARSER & GEOMETRY SANITIZER (`backend/cad_parser.py`)
Owner: Benjamin Torres
Rome Cabinets - Automated Cutting List & Shop-Floor Coordinator
==============================================================================
Extracts axis-aligned bounding boxes (Length, Width, Thickness) from
intermediate 3D CAD exports (.dae Collada, .obj Wavefront, .csv Schedules)
and enforces the Pre-Check Geometry Sanitizer (halts on zero-thickness,
negative volume, or non-manifold mesh topology).
"""

from __future__ import annotations
from typing import Any, Dict, List
import uuid


def sanitize_and_extract_part(
    raw_comp: Dict[str, Any], index: int = 1, project_id: str = "Job #1"
) -> Dict[str, Any]:
    """
    Validates a single CAD component's bounding-box geometry and returns a
    canonical Part Entity Schema dictionary. Raises ValueError if geometry is
    non-manifold or has non-positive dimensions.
    """
    l_val = float(raw_comp.get("l", raw_comp.get("length", 0.0)))
    w_val = float(raw_comp.get("w", raw_comp.get("width", 0.0)))
    h_val = float(raw_comp.get("h", raw_comp.get("thickness", 0.0)))

    if l_val <= 0.0 or w_val <= 0.0 or h_val <= 0.0:
        raise ValueError(
            f"Pre-check geometry sanitizer halted parsing: component #{index} "
            f"has invalid/non-positive dimensions ({l_val} x {w_val} x {h_val})."
        )

    if raw_comp.get("corrupted_normals") or raw_comp.get("non_manifold"):
        raise ValueError(
            f"Pre-check geometry sanitizer halted parsing: component #{index} "
            f"contains non-manifold mesh topology."
        )

    # Sort bounding box dimensions so Length >= Width >= Thickness
    dims = sorted([l_val, w_val, h_val], reverse=True)
    part_name = str(raw_comp.get("part", raw_comp.get("part_name", f"Panel_{index}")))
    qty = int(raw_comp.get("qty", raw_comp.get("quantity", 1)))
    material = str(raw_comp.get("material", "18mm Marine Plywood"))
    corner = str(raw_comp.get("corner", raw_comp.get("corner_cut", "None")))

    return {
        "id": str(raw_comp.get("id", f"part-{uuid.uuid4().hex[:8]}")),
        "num": f"#{index}",
        "project_id": str(raw_comp.get("project_id", project_id)),
        "part": part_name,
        "part_name": part_name,
        "qty": qty,
        "quantity": qty,
        "l": round(dims[0], 2),
        "w": round(dims[1], 2),
        "h": round(dims[2], 2),
        "length": round(dims[0], 2),
        "width": round(dims[1], 2),
        "thickness": round(dims[2], 2),
        "material": material,
        "corner": corner,
        "corner_cut": corner,
        "source": "CAD",
        "source_jobs": list(raw_comp.get("source_jobs", [project_id])),
        "remarks": str(raw_comp.get("remarks", "Allocate to Stock Sheet #1")),
    }


def decompose_compound_cad_component(
    raw_comp: Dict[str, Any], default_thickness: float = 18.0
) -> List[Dict[str, Any]]:
    """
    Decomposes a compound 3D bounding-box component (min_dim > 25 mm) into
    discrete flat rectangular panels (Top/Bottom/Shelf, Left/Right/Divider,
    Back/Front) and suppresses redundant stacked top faces.
    """
    l_val = float(raw_comp.get("l", raw_comp.get("length", 0.0)))
    w_val = float(raw_comp.get("w", raw_comp.get("width", 0.0)))
    h_val = float(raw_comp.get("h", raw_comp.get("thickness", 0.0)))
    min_dim = min(l_val, w_val, h_val)
    if min_dim <= 25.0:
        return [raw_comp]

    dims = sorted([l_val, w_val, h_val], reverse=True)
    span_l, span_w, span_d = dims[0], dims[1], dims[2]
    is_cubby = bool(raw_comp.get("flush_beneath_top") or span_d <= 120.0)

    if is_cubby:
        # Retain only vertical dividers (side legs) for upper cubby flush beneath Top Panel
        return [
            {
                **raw_comp,
                "part": "Divider L",
                "l": span_w,
                "w": span_d,
                "h": default_thickness,
            },
            {
                **raw_comp,
                "part": "Divider R",
                "l": span_w,
                "w": span_d,
                "h": default_thickness,
            },
        ]

    return [
        {
            **raw_comp,
            "part": "Back Panel",
            "l": span_l,
            "w": span_w,
            "h": default_thickness,
        },
        {
            **raw_comp,
            "part": "Left Side Panel",
            "l": span_w,
            "w": span_d,
            "h": default_thickness,
        },
        {
            **raw_comp,
            "part": "Right Side Panel",
            "l": span_w,
            "w": span_d,
            "h": default_thickness,
        },
        {
            **raw_comp,
            "part": "Bottom Panel",
            "l": span_l,
            "w": span_d,
            "h": default_thickness,
        },
    ]


def parse_cad_payload(payload: Dict[str, Any], project_id: str = "Job #1") -> List[Dict[str, Any]]:
    """
    Parses a structured CAD payload containing a list of mesh components.
    """
    if not isinstance(payload, dict) or "components" not in payload:
        raise ValueError("Malformed CAD payload: missing 'components' root node.")

    components = payload["components"]
    if not isinstance(components, list) or len(components) == 0:
        raise ValueError("Malformed CAD payload: empty component list.")

    return [
        sanitize_and_extract_part(comp, index=idx, project_id=project_id)
        for idx, comp in enumerate(components, start=1)
    ]
