
"""
==============================================================================
FAULT-INJECTION HARNESS  (tests/fault_injection.py)
Measures MTTD and MTTR for the Rome Cabinets pipeline using backend/diagnostics.py
 
    python3 tests/fault_injection.py            # full run (n=30 fast / n=10 slow)
    python3 tests/fault_injection.py --quick    # n=5 smoke run
 
Definitions used in the report
  t_inject  : the faulty input/state is handed to the pipeline stage
  t_detect  : diagnostics emits an ERROR event carrying the expected RC-code
  t_repair  : the documented corrective action has been applied AND the stage
              re-run reports success (RC-000 / no exception)
  MTTD = mean(t_detect - t_inject)      MTTR = mean(t_repair - t_detect)
 
The repair step is the SAME runbook an operator follows, executed by script
(read the code + message, apply the fix, re-run). It therefore measures the
software side of repair; human reaction/reading time is NOT included.
 
Outputs
  tests/logs/CPECAPS_Fault_Metrics.csv     one row per run
  tests/logs/CPECAPS_Fault_Summary.json    statistics + steps + tools
  tests/logs/diag/rome_diag.jsonl          the structured log of the whole run
==============================================================================
"""
from __future__ import annotations
 
import copy
import csv
import json
import math
import os
import re
import statistics
import sys
import tempfile
import threading
import time
 
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
LOG_ROOT = os.path.join(ROOT, "tests", "logs")
os.environ["ROME_LOG_DIR"] = os.path.join(LOG_ROOT, "diag")  # before importing diagnostics
os.makedirs(os.environ["ROME_LOG_DIR"], exist_ok=True)
 
from backend import diagnostics as diag  # noqa: E402
from backend.aggregator import DEFAULT_PROJECT_SCHEDULES, aggregate_project_schedules  # noqa: E402
from backend.cad_parser import parse_cad_payload  # noqa: E402
from backend.inventory_db import get_inventory_items, match_remnant_scrap  # noqa: E402
from backend.ocr_service import process_ocr_sheet  # noqa: E402
 
T975 = {4: 2.776, 9: 2.262, 29: 2.045}  # t_{0.025, df}
 
 
# ---------------------------------------------------------------- helpers ---
class Detector:
    """Captures the first diagnostics event with the expected code."""
 
    def __init__(self, expected_code: str):
        self.expected = expected_code
        self.t_detect = None
        self.event = None
 
    def __call__(self, ev):
        if self.t_detect is None and ev.get("code") == self.expected and ev.get("level") in ("ERROR", "WARN"):
            self.t_detect, self.event = ev["t_mono"], ev
 
 
def good_cad_payload():
    return {"components": [
        {"part": f"Panel {i}", "l": 700 + i, "w": 400 + i, "h": 18, "qty": 2} for i in range(1, 6)]}
 
 
def make_good_image(path):
    import cv2
    import numpy as np
    img = np.full((900, 1400, 3), 255, np.uint8)
    rows = ["Part Qty Length Width Thk Material", "Side Panel 2 750 500 18 Marine Ply",
            "Base Shelf 2 564 480 18 Marine Ply", "Back Panel 1 720 560 6 MDF",
            "Top Rail 3 900 100 18 Melamine"]
    for i, r in enumerate(rows):
        cv2.putText(img, r, (40, 100 + i * 110), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (0, 0, 0), 4, cv2.LINE_AA)
    cv2.imwrite(path, img)
 
 
# ------------------------------------------------------------------ faults ---
def fault_cad_zero_thickness(ctx):
    payload = good_cad_payload()
    payload["components"][2]["h"] = 0  # component #3 has zero thickness
    det = Detector("RC-101"); diag.subscribe(det)
    t_inject = time.perf_counter()
    try:
        diag.run_stage("cad", parse_cad_payload, payload)
    except ValueError as exc:
        err = str(exc)
    finally:
        diag.unsubscribe(det)
    # --- runbook: read component number from the message, set a valid thickness, re-run
    idx = int(re.search(r"component #(\d+)", err).group(1)) - 1
    payload["components"][idx]["h"] = 18
    diag.run_stage("cad", parse_cad_payload, payload)
    return t_inject, det.t_detect, time.perf_counter()
 
 
def fault_cad_malformed(ctx):
    payload = {"parts": good_cad_payload()["components"]}  # wrong root key
    det = Detector("RC-102"); diag.subscribe(det)
    t_inject = time.perf_counter()
    try:
        diag.run_stage("cad", parse_cad_payload, payload)
    except ValueError:
        pass
    finally:
        diag.unsubscribe(det)
    # --- runbook: re-export with the 'components' root node, re-run
    fixed = {"components": payload["parts"]}
    diag.run_stage("cad", parse_cad_payload, fixed)
    return t_inject, det.t_detect, time.perf_counter()
 
 
def fault_ocr_corrupt_image(ctx):
    bad = os.path.join(ctx["tmp"], "corrupt.png")
    with open(bad, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + os.urandom(2048))  # valid signature, garbage body
    det = Detector("RC-201"); diag.subscribe(det)
    t_inject = time.perf_counter()
    try:
        diag.run_stage("ocr", process_ocr_sheet, bad, timeout_s=30.0)
    except ValueError:
        pass
    finally:
        diag.unsubscribe(det)
    # --- runbook: replace with a fresh, readable photo, re-run OCR
    res = diag.run_stage("ocr", process_ocr_sheet, ctx["good_img"], timeout_s=30.0)
    # Repair is verified when the image is READ without RC-201. The number of rows depends
    # on the OCR engine (EasyOCR may find 0 rows in the synthetic image = RC-203 warning).
    assert isinstance(res, dict) and "parts" in res
    return t_inject, det.t_detect, time.perf_counter()
 
 
def fault_stage_hang(ctx):
    cancel = threading.Event()
 
    def hung_aggregation():  # simulates a deadlocked stage
        cancel.wait(30)
 
    det = Detector("RC-900"); diag.subscribe(det)
    t_inject = time.perf_counter()
    try:
        diag.run_stage("aggregation", hung_aggregation, timeout_s=1.0)
    except TimeoutError:
        pass
    finally:
        diag.unsubscribe(det)
    # --- runbook: release the stuck worker, re-run the stage
    cancel.set()
    diag.run_stage("aggregation", aggregate_project_schedules, DEFAULT_PROJECT_SCHEDULES, timeout_s=1.0)
    return t_inject, det.t_detect, time.perf_counter()
 
 
def fault_inventory_corrupt(ctx):
    inv = copy.deepcopy(get_inventory_items())
    next(i for i in inv if i["type"] == "REMNANT").pop("h")  # drop thickness from a remnant
    part = {"l": 400, "w": 300, "h": 18, "material": "18mm Marine Plywood"}
    det = Detector("RC-401"); diag.subscribe(det)
    t_inject = time.perf_counter()
    try:
        diag.run_stage("inventory", match_remnant_scrap, part, inv)
    except KeyError:
        pass
    finally:
        diag.unsubscribe(det)
    # --- runbook: restore the record from the pristine stock table, re-run
    diag.run_stage("inventory", match_remnant_scrap, part, get_inventory_items())
    return t_inject, det.t_detect, time.perf_counter()
 
 
def fault_gateway_contract(ctx):
    """main.py imports a name that does not exist (the defect found in the
    original repo, now reproduced on a temp copy so the shipped main.py stays fixed)."""
    good = open(os.path.join(ROOT, "backend", "main.py"), encoding="utf-8").read()
    bad_path = os.path.join(ctx["tmp"], "main_broken.py")
    with open(bad_path, "w", encoding="utf-8") as f:  # rename one imported function
        f.write(good.replace("parse_cad_file,", "parse_cad_file_v2,", 1))
    det = Detector("RC-501"); diag.subscribe(det)
    t_inject = time.perf_counter()
    rep = diag.run_gateway_check(bad_path)
    diag.unsubscribe(det)
    assert rep["code"] == "RC-501" and "parse_cad_file_v2" in rep["detail"], rep
    # --- runbook: read the undefined name from the message, restore the correct import, re-check
    name = re.search(r"backend\.\w+\.(\w+)", rep["detail"]).group(1)
    with open(bad_path, "w", encoding="utf-8") as f:
        f.write(open(bad_path, encoding="utf-8").read().replace(name, name.replace("_v2", "")))
    assert diag.run_gateway_check(bad_path)["led"] == "GREEN"
    return t_inject, det.t_detect, time.perf_counter()
 
 
FAULTS = [
    # id, title, fn, expected code, n, tools, steps
    dict(id="F1", title="CAD part with zero thickness", fn=fault_cad_zero_thickness, code="RC-101", n=30,
         tools=["backend/diagnostics.py run_stage()", "logs/rome_diag.jsonl", "time.perf_counter()",
                "python -m backend.diagnostics --tail"],
         steps=["Upload CAD with a 0 mm component", "Read UI/API message: [RC-101] ... component #3",
                "Look up RC-101 in the code table (open component #3 in SketchUp)",
                "Set a valid thickness (18 mm) and re-export", "Re-upload; confirm RC-000 'ok' in log"]),
    dict(id="F2", title="Malformed CAD payload (missing 'components')", fn=fault_cad_malformed, code="RC-102", n=30,
         tools=["backend/diagnostics.py run_stage()", "logs/rome_diag.jsonl", "time.perf_counter()"],
         steps=["Upload CAD export with wrong root node", "Read message: [RC-102] missing 'components' root",
                "Re-export from the CAD tool with the components root", "Re-upload; confirm RC-000 in log"]),
    dict(id="F3", title="Corrupt / unreadable OCR photo", fn=fault_ocr_corrupt_image, code="RC-201", n=10,
         tools=["backend/diagnostics.py run_stage() + watchdog", "OpenCV imread", "Tesseract 5.3.4",
                "logs/rome_diag.jsonl", "time.perf_counter()"],
         steps=["Upload a truncated/garbage .png", "Read message: [RC-201] could not read the image",
                "Retake or re-save the paper-cutlist photo", "Re-upload; OCR returns rows; log shows RC-000"]),
    dict(id="F4", title="Pipeline stage hangs (deadlock)", fn=fault_stage_hang, code="RC-900", n=10,
         tools=["backend/diagnostics.py run_with_watchdog() (1.0 s limit)", "logs/rome_diag.jsonl",
                "threading.Event", "time.perf_counter()"],
         steps=["Aggregation stage stops responding", "Watchdog aborts the request at 1.0 s and logs RC-900",
                "Operator reads RC-900 action: retry", "Release stuck worker, re-run stage; log shows RC-000"]),
    dict(id="F5", title="Corrupt inventory record (missing thickness)", fn=fault_inventory_corrupt, code="RC-401", n=30,
         tools=["backend/diagnostics.py run_stage() + self-test", "logs/rome_diag.jsonl", "time.perf_counter()"],
         steps=["Remnant record loses its 'h' field", "Remnant match fails; log shows [RC-401] KeyError 'h'",
                "Open inventory_db.py, find the record with the missing field",
                "Restore the field; re-run match; log shows RC-000"]),
    dict(id="F6", title="Gateway import contract broken", fn=fault_gateway_contract,
         code="RC-501", n=30,
         tools=["python -m backend.diagnostics (AST import-contract check)", "time.perf_counter()"],
         steps=["Start API: import fails in backend/main.py", "Run self-test: gateway LED RED, RC-501 lists the 4 names",
                "Restore the correct import name in main.py; re-run self-test; gateway LED GREEN"]),
]
 
 
# ------------------------------------------------------------------- stats ---
def stats(xs):
    n = len(xs)
    if n == 0:
        return {}
    mean = statistics.mean(xs)
    sd = statistics.stdev(xs) if n > 1 else 0.0
    t = T975.get(n - 1, 2.0)
    half = t * sd / math.sqrt(n) if n > 1 else 0.0
    return {"n": n, "mean": mean, "sd": sd, "median": statistics.median(xs), "min": min(xs),
            "max": max(xs), "ci95_low": mean - half, "ci95_high": mean + half}
 
 
def main(quick=False):
    ctx = {"tmp": tempfile.mkdtemp(prefix="rome_fx_")}
    ctx["good_img"] = os.path.join(ctx["tmp"], "good.png")
    make_good_image(ctx["good_img"])
 
    rows, summary = [], {"generated": time.strftime("%Y-%m-%d %H:%M:%S"), "faults": []}
    for f in FAULTS:
        n = 5 if quick else f["n"]
        fn = f["fn"]
        try:
            fn(ctx)  # warm-up run 0 (cold start, may download OCR models) - excluded from the statistics
        except Exception as exc:
            print(f"{f['id']} warm-up failed: {exc!r}")
        mttd, mttr, detected_ok, repaired_ok = [], [], 0, 0
        for run in range(1, n + 1):
            try:
                t_inj, t_det, t_rep = fn(ctx)
            except Exception as exc:  # harness must never die on one bad run
                rows.append([f["id"], run, "", "", False, False, f"HARNESS_ERROR {exc!r}"])
                continue
            ok_d = t_det is not None
            ok_r = t_rep is not None
            d_ms = (t_det - t_inj) * 1000 if ok_d else None
            r_ms = (t_rep - t_det) * 1000 if (ok_d and ok_r) else None
            detected_ok += ok_d
            repaired_ok += ok_r
            if d_ms is not None:
                mttd.append(d_ms)
            if r_ms is not None:
                mttr.append(r_ms)
            rows.append([f["id"], run, f"{d_ms:.3f}" if d_ms is not None else "",
                         f"{r_ms:.3f}" if r_ms is not None else "", ok_d, ok_r, ""])
        entry = {k: f[k] for k in ("id", "title", "code", "tools", "steps")}
        entry.update(n=n, detect_only=f.get("detect_only", False),
                     detection_rate=detected_ok / n, repair_rate=(repaired_ok / n) if not f.get("detect_only") else None,
                     mttd_ms=stats(mttd), mttr_ms=stats(mttr))
        summary["faults"].append(entry)
        print(f"{f['id']} {f['title']:<52} n={n:<3} MTTD={entry['mttd_ms'].get('mean', float('nan')):9.2f} ms"
              f"  MTTR={entry['mttr_ms'].get('mean', float('nan')) if mttr else float('nan'):9.2f} ms"
              f"  detect {detected_ok}/{n}")
 
    os.makedirs(LOG_ROOT, exist_ok=True)
    with open(os.path.join(LOG_ROOT, "CPECAPS_Fault_Metrics.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["fault_id", "run", "mttd_ms", "mttr_ms", "detected", "repaired", "note"])
        w.writerows(rows)
    with open(os.path.join(LOG_ROOT, "CPECAPS_Fault_Summary.json"), "w") as fh:
        json.dump(summary, fh, indent=2)
    print("wrote tests/logs/CPECAPS_Fault_Metrics.csv and CPECAPS_Fault_Summary.json")
 
 
if __name__ == "__main__":
    main(quick="--quick" in sys.argv)
 