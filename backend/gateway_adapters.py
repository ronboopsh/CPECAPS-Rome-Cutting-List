"""
backend/gateway_adapters.py
Thin adapters between the API gateway (backend/main.py) and the partner modules.

main.py was importing four functions that do not exist
(parse_cad_file, aggregate_projects, get_inventory_stock, match_remnants), so the
API could not start (diagnostics: gateway LED RED, RC-501). The partner modules
keep their own names; these adapters translate file paths / project ids into
what those modules expect and return PartEntity-shaped dicts.
"""
from __future__ import annotations

import csv
import os
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List

from backend.aggregator import DEFAULT_PROJECT_SCHEDULES, aggregate_project_schedules
from backend.cad_parser import parse_cad_payload
from backend.inventory_db import get_inventory_items, match_remnant_scrap


# ----------------------------------------------------------------- CAD ------
def _bbox(points: List[tuple]) -> tuple:
    xs, ys, zs = zip(*points)
    return (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))


def _components_from_csv(path: str) -> List[Dict[str, Any]]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise ValueError("Malformed CAD payload: empty component list.")
    comps = []
    for r in rows:
        comps.append({
            "id": r.get("id") or None,
            "project_id": r.get("project_id") or None,
            "part": r.get("part_name") or r.get("part") or None,
            "qty": r.get("quantity") or r.get("qty") or 1,
            "l": r.get("length") or r.get("l") or 0,
            "w": r.get("width") or r.get("w") or 0,
            "h": r.get("thickness") or r.get("h") or 0,
            "material": r.get("material") or "18mm Marine Plywood",
            "corner": r.get("corner_cut") or r.get("corner") or "None",
        })
    return [{k: v for k, v in c.items() if v is not None} for c in comps]


def _components_from_obj(path: str) -> List[Dict[str, Any]]:
    """One component per `o` object: its axis-aligned bounding box."""
    groups: Dict[str, List[tuple]] = {}
    verts: List[tuple] = []
    current = "Panel_1"
    with open(path, encoding="utf-8") as f:
        for line in f:
            tok = line.split()
            if not tok or tok[0].startswith("#"):
                continue
            if tok[0] == "o" and len(tok) > 1:
                current = tok[1]
                groups.setdefault(current, [])
            elif tok[0] == "v" and len(tok) >= 4:
                p = (float(tok[1]), float(tok[2]), float(tok[3]))
                groups.setdefault(current, []).append(p)
                verts.append(p)
    comps = []
    for name, pts in groups.items():
        if not pts:
            continue
        l, w, h = _bbox(pts)
        comps.append({"part": name, "l": l, "w": w, "h": h})
    if not comps:
        raise ValueError("Malformed CAD payload: empty component list.")
    return comps


def _components_from_dae(path: str) -> List[Dict[str, Any]]:
    """One component per <geometry>: bbox of its position float_array."""
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        raise ValueError(f"Malformed CAD payload: invalid Collada XML ({e}).")
    comps = []
    for geom in root.iter():
        if not geom.tag.endswith("geometry"):
            continue
        arr = next((e for e in geom.iter() if e.tag.endswith("float_array")), None)
        if arr is None or not (arr.text or "").strip():
            continue
        nums = [float(x) for x in re.split(r"\s+", arr.text.strip())]
        pts = [tuple(nums[i:i + 3]) for i in range(0, len(nums) - 2, 3)]
        if pts:
            l, w, h = _bbox(pts)
            comps.append({"part": geom.get("name") or geom.get("id") or "Panel", "l": l, "w": w, "h": h})
    if not comps:
        raise ValueError("Malformed CAD payload: empty component list.")
    return comps


def parse_cad_file(path: str, project_id: str = "job-cad-default") -> List[Dict[str, Any]]:
    """Read .csv/.obj/.dae and return canonical parts (runs the geometry sanitizer)."""
    ext = os.path.splitext(path)[1].lower()
    readers = {".csv": _components_from_csv, ".obj": _components_from_obj, ".dae": _components_from_dae}
    if ext not in readers:
        raise ValueError(f"Unsupported CAD format: {ext}")
    return parse_cad_payload({"components": readers[ext](path)}, project_id=project_id)


# ----------------------------------------------------------- aggregation ----
def _to_entity(part: Dict[str, Any]) -> Dict[str, Any]:
    jobs = part.get("source_jobs") or []
    return {
        **part,
        "project_id": str(part.get("project_id") or (jobs[0] if jobs else "aggregated")),
        "part_name": part.get("part_name") or part.get("part", ""),
        "quantity": int(part.get("quantity", part.get("qty", 1))),
        "length": float(part.get("length", part.get("l", 0.0))),
        "width": float(part.get("width", part.get("w", 0.0))),
        "thickness": float(part.get("thickness", part.get("h", 18.0))),
        "corner_cut": part.get("corner_cut") or part.get("corner") or "None",
        "source": part.get("source", "CAD"),
    }


def aggregate_projects(project_ids: List[str]) -> List[Dict[str, Any]]:
    known = [p for p in project_ids if p in DEFAULT_PROJECT_SCHEDULES]
    if not known:
        raise ValueError("None of the requested project ids exist: " + ", ".join(project_ids))
    result = aggregate_project_schedules(DEFAULT_PROJECT_SCHEDULES, selected_jobs=known)
    return [_to_entity(p) for p in result["parts"]]


# -------------------------------------------------------------- inventory ---
def get_inventory_stock() -> List[Dict[str, Any]]:
    return get_inventory_items()


def match_remnants(parts: List[Dict[str, Any]], min_utilization: float = 0.70) -> List[Dict[str, Any]]:
    """min_utilization arrives as a fraction (0.70); the matcher wants percent."""
    pct = min_utilization * 100.0 if min_utilization <= 1.0 else float(min_utilization)
    out = []
    for p in parts:
        res = match_remnant_scrap(p, min_utilization_pct=pct)
        out.append({"part_id": p.get("id"), "part_name": p.get("part_name"), **res})
    return out
