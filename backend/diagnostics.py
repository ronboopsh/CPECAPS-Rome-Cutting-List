
"""
==============================================================================
DIAGNOSTICS (`backend/diagnostics.py`)
Rome Cabinets - Automated Cutting List & Shop-Floor Coordinator
==============================================================================
Software equivalent of the "status LEDs, error codes, logs, watchdogs" a
hardware product would have:
 
  * Status LEDs ....... run_self_test() -> GREEN / AMBER / RED per subsystem
  * Error codes ....... ERROR_CODES registry (RC-xxx), attached to every fault
  * Logs .............. structured JSON-lines file  logs/rome_diag.jsonl
  * Watchdog .......... run_with_watchdog() aborts a stage that hangs (RC-900)
  * Latency budgets ... run_stage() warns (RC-901) when a stage exceeds the
                        budgets in PROJECT_CONTEXT.md (CAD/aggregation 1 s,
                        OCR 5 s)
 
No third-party dependency is required for the core (psutil is optional).
 
CLI (works without FastAPI):
    python -m backend.diagnostics            # LED panel (exit code 0/1/2)
    python -m backend.diagnostics --tail 20  # last 20 log events
    python -m backend.diagnostics --codes    # error-code reference
    python -m backend.diagnostics --explain RC-101   # first repair action for one code
"""
 
from __future__ import annotations
 
import ast
import importlib
import json
import logging
import os
import shutil
import sys
import tempfile
import threading
import time
from collections import deque
from logging.handlers import RotatingFileHandler
from typing import Any, Callable, Deque, Dict, List, Optional
 
# --------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.environ.get("ROME_LOG_DIR", os.path.join(ROOT_DIR, "logs"))
LOG_PATH = os.path.join(LOG_DIR, "rome_diag.jsonl")
 
GREEN, AMBER, RED = "GREEN", "AMBER", "RED"
_LED_RANK = {GREEN: 0, AMBER: 1, RED: 2}
 
# Latency budgets (seconds) from PROJECT_CONTEXT.md section 5
STAGE_BUDGET_S = {"cad": 1.0, "aggregation": 1.0, "inventory": 1.0, "ocr": 5.0}
RAM_LIMIT_MB = 500.0
MIN_FREE_DISK_MB = 200.0
 
# --------------------------------------------------------------------------
# Error-code registry:  code -> (title, what it means / first repair action)
# --------------------------------------------------------------------------
ERROR_CODES: Dict[str, tuple] = {
    "RC-000": ("OK", "No fault."),
    "RC-101": ("CAD geometry invalid",
               "Zero/negative dimension or non-manifold mesh. Open the model in "
               "SketchUp, fix the flagged component number, re-export."),
    "RC-102": ("CAD payload malformed",
               "Missing 'components' root or empty list. Re-export the CAD file."),
    "RC-103": ("CAD/OCR file type unsupported",
               "Use .dae/.obj/.csv for CAD or .png/.jpg for OCR."),
    "RC-201": ("OCR image unreadable",
               "File is not a valid image (corrupt/truncated). Re-take or re-save the photo."),
    "RC-202": ("OCR engine missing",
               "Neither EasyOCR nor Tesseract is installed. pip install easyocr."),
    "RC-203": ("OCR returned 0 rows",
               "Image read but no cutlist rows found. Retake photo flat, well-lit."),
    "RC-204": ("OCR running on fallback engine",
               "EasyOCR not installed; Tesseract is in use. Accuracy may drop."),
    "RC-301": ("Aggregation failed",
               "A part row is missing l/w/h/material. Check the source schedule."),
    "RC-401": ("Inventory record invalid",
               "Stock/remnant record missing id/type/l/w/h/material. Fix inventory_db.py data."),
    "RC-501": ("Gateway import contract broken",
               "backend/main.py imports a function that does not exist in the "
               "backend module. API will not start. Fix the name or add the function."),
    "RC-505": ("Python dependency missing",
               "A required package is not installed. pip install -r backend/requirements.txt."),
    "RC-502": ("Temp dir not writable / low disk",
               "Free disk space or fix permissions on the upload temp directory."),
    "RC-503": ("RAM above limit",
               "Process RSS above 500 MB target. Restart backend; check for leaks."),
    "RC-900": ("Watchdog timeout",
               "A pipeline stage did not finish inside its time limit and was aborted. "
               "Retry; if repeatable, inspect the stage's last log lines."),
    "RC-901": ("Latency budget exceeded",
               "Stage finished but slower than its budget. Check CPU load / input size."),
    "RC-999": ("Unclassified fault",
               "Not mapped to a code yet. Read the 'msg' field and add a rule to classify()."),
}
 
 
class WatchdogTimeout(TimeoutError):
    """Raised when a stage exceeds its watchdog limit."""
 
 
# --------------------------------------------------------------------------
# Structured logging  (JSON lines, rotating, + in-memory ring buffer)
# --------------------------------------------------------------------------
_logger = logging.getLogger("rome.diag")
_logger.setLevel(logging.INFO)
_logger.propagate = False
_log_lock = threading.Lock()
_RECENT: Deque[Dict[str, Any]] = deque(maxlen=500)
_SUBSCRIBERS: List[Callable[[Dict[str, Any]], None]] = []
_handler_ready = False
 
 
def _ensure_handler() -> None:
    global _handler_ready
    if _handler_ready:
        return
    os.makedirs(LOG_DIR, exist_ok=True)
    h = RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    h.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(h)
    _handler_ready = True
 
 
def subscribe(callback: Callable[[Dict[str, Any]], None]) -> None:
    """Register a listener called for every event (used by the fault harness
    to timestamp the exact moment a fault is *detected*)."""
    _SUBSCRIBERS.append(callback)
 
 
def unsubscribe(callback: Callable[[Dict[str, Any]], None]) -> None:
    if callback in _SUBSCRIBERS:
        _SUBSCRIBERS.remove(callback)
 
 
def log_event(level: str, code: str, stage: str, msg: str, **extra: Any) -> Dict[str, Any]:
    """Write one structured event. Returns the event dict."""
    ev = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime()) + f".{int((time.time() % 1) * 1000):03d}",
        "level": level,
        "code": code,
        "stage": stage,
        "msg": msg,
        **extra,
    }
    with _log_lock:
        _ensure_handler()
        _logger.info(json.dumps(ev, default=str))
        _RECENT.append(ev)
    ev_for_cb = dict(ev, t_mono=time.perf_counter())
    for cb in list(_SUBSCRIBERS):
        try:
            cb(ev_for_cb)
        except Exception:  # a broken listener must never break the pipeline
            pass
    return ev
 
 
def tail(n: int = 20) -> List[Dict[str, Any]]:
    """Last n events from the log file (survives restarts)."""
    if not os.path.exists(LOG_PATH):
        return []
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()[-n:]
    out = []
    for ln in lines:
        try:
            out.append(json.loads(ln))
        except json.JSONDecodeError:
            out.append({"level": "ERROR", "code": "RC-999", "stage": "log", "msg": "corrupt log line"})
    return out
 
 
# --------------------------------------------------------------------------
# Classification: exception -> error code
# --------------------------------------------------------------------------
def classify(exc: BaseException, stage: str) -> str:
    text = str(exc).lower()
    if isinstance(exc, TimeoutError):
        return "RC-900"
    if isinstance(exc, ImportError):
        return "RC-501"
    if isinstance(exc, PermissionError):
        return "RC-502"
    if isinstance(exc, ConnectionError):
        return "RC-501"
    if stage == "cad":
        if "malformed cad" in text:
            return "RC-102"
        if isinstance(exc, ValueError):
            return "RC-101"
    if stage == "ocr":
        if "no ocr engine" in text:
            return "RC-202"
        if "could not read" in text:
            return "RC-201"
    if stage == "aggregation" and isinstance(exc, (KeyError, ValueError, TypeError)):
        return "RC-301"
    if stage == "inventory" and isinstance(exc, (KeyError, ValueError, TypeError)):
        return "RC-401"
    return "RC-999"
 
 
# --------------------------------------------------------------------------
# Watchdog + guarded stage runner
# --------------------------------------------------------------------------
def run_with_watchdog(fn: Callable[..., Any], timeout_s: float, *args: Any, **kwargs: Any) -> Any:
    """Run fn in a worker thread; raise WatchdogTimeout if it does not finish.
 
    NOTE: Python cannot kill a thread. The hung worker is a daemon thread and
    is abandoned; the *request* is released and the fault is logged. For a hard
    kill, run the stage in a subprocess (see recommendations)."""
    box: Dict[str, Any] = {}
 
    def _target() -> None:
        try:
            box["value"] = fn(*args, **kwargs)
        except BaseException as e:  # noqa: BLE001 - re-raised below
            box["error"] = e
 
    t = threading.Thread(target=_target, daemon=True, name=f"wd-{getattr(fn, '__name__', 'fn')}")
    t.start()
    t.join(timeout_s)
    if t.is_alive():
        raise WatchdogTimeout(f"stage did not finish within {timeout_s:.2f}s")
    if "error" in box:
        raise box["error"]
    return box.get("value")
 
 
def run_stage(stage: str, fn: Callable[..., Any], *args: Any,
              timeout_s: Optional[float] = None, run_id: Optional[str] = None, **kwargs: Any) -> Any:
    """Run one pipeline stage with logging, error code, latency budget and
    optional watchdog. The ORIGINAL exception is re-raised (so existing
    `except ValueError` handlers keep working) with `.rc_code` attached."""
    t0 = time.perf_counter()
    try:
        result = run_with_watchdog(fn, timeout_s, *args, **kwargs) if timeout_s else fn(*args, **kwargs)
    except BaseException as exc:  # noqa: BLE001
        code = classify(exc, stage)
        exc.rc_code = code  # type: ignore[attr-defined]
        log_event("ERROR", code, stage, f"{type(exc).__name__}: {exc}",
                  duration_ms=round((time.perf_counter() - t0) * 1000, 2), run_id=run_id)
        raise
    dur = time.perf_counter() - t0
    budget = STAGE_BUDGET_S.get(stage)
    if budget is not None and dur > budget:
        log_event("WARN", "RC-901", stage, f"took {dur:.3f}s, budget {budget:.1f}s",
                  duration_ms=round(dur * 1000, 2), run_id=run_id)
    else:
        log_event("INFO", "RC-000", stage, "ok", duration_ms=round(dur * 1000, 2), run_id=run_id)
    return result
 
 
# --------------------------------------------------------------------------
# Status-LED self test
# --------------------------------------------------------------------------
def _check(name: str, fn: Callable[[], tuple]) -> Dict[str, Any]:
    t0 = time.perf_counter()
    try:
        led, code, detail = fn()
    except BaseException as exc:  # noqa: BLE001
        led, code, detail = RED, classify(exc, name), f"{type(exc).__name__}: {exc}"
    return {"name": name, "led": led, "code": code, "detail": detail,
            "ms": round((time.perf_counter() - t0) * 1000, 2)}
 
 
def _defined_names(path: str) -> set:
    """Top-level names a module defines/imports, read statically (no import)."""
    tree = ast.parse(open(path, encoding="utf-8").read())
    names: set = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(node.name)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for t in targets:
                for n in ast.walk(t):
                    if isinstance(n, ast.Name):
                        names.add(n.id)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                names.add((a.asname or a.name).split(".")[0])
    return names
 
 
def _chk_gateway(main_path: Optional[str] = None) -> tuple:
    """Every `from backend.X import a, b` in main.py must resolve to a name
    that backend/X.py really defines. Static (AST) check: no imports executed,
    so it works even when FastAPI/OpenCV are not installed.
    `main_path` lets tests point the check at a copy of main.py."""
    main_path = main_path or os.path.join(ROOT_DIR, "backend", "main.py")
    tree = ast.parse(open(main_path, encoding="utf-8").read())
    missing: List[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("backend."):
            mod_path = os.path.join(ROOT_DIR, *node.module.split(".")) + ".py"
            if not os.path.exists(mod_path):
                missing.append(f"{node.module} (file not found)")
                continue
            defined = _defined_names(mod_path)
            missing += [f"{node.module}.{a.name}" for a in node.names if a.name not in defined]
    if missing:
        return RED, "RC-501", "main.py imports undefined names: " + ", ".join(missing)
    return GREEN, "RC-000", "all main.py imports resolve"
 
 
def _chk_deps() -> tuple:
    import importlib.util as iu
    core = {"fastapi": "fastapi", "uvicorn": "uvicorn", "cv2": "opencv-python", "numpy": "numpy"}
    missing = [pkg for mod, pkg in core.items() if iu.find_spec(mod) is None]
    if missing:
        return RED, "RC-505", "missing packages: " + ", ".join(missing) + "  (pip install -r backend/requirements.txt)"
    if iu.find_spec("psutil") is None:
        return AMBER, "RC-505", "optional package missing: psutil (RAM check disabled)"
    return GREEN, "RC-000", "core Python packages importable"
 
 
def _chk_cad() -> tuple:
    from backend.cad_parser import sanitize_and_extract_part
    ok = sanitize_and_extract_part({"l": 750, "w": 500, "h": 18, "part": "selftest"})
    try:
        sanitize_and_extract_part({"l": 750, "w": 500, "h": 0, "part": "selftest"})
        return RED, "RC-101", "sanitizer accepted a zero-thickness part"
    except ValueError:
        pass
    return GREEN, "RC-000", f"sanitizer OK ({ok['l']}x{ok['w']}x{ok['h']}), rejects zero-thickness"
 
 
def _chk_ocr() -> tuple:
    from backend import ocr_service as o
    if o.HAS_EASYOCR:
        return GREEN, "RC-000", "engine: easyocr"
    if o.HAS_TESSERACT:
        return AMBER, "RC-204", "engine: tesseract (fallback; EasyOCR not installed)"
    return RED, "RC-202", "no OCR engine installed"
 
 
def _chk_aggregation() -> tuple:
    from backend.aggregator import DEFAULT_PROJECT_SCHEDULES, aggregate_project_schedules
    res = aggregate_project_schedules(DEFAULT_PROJECT_SCHEDULES)
    if not res:
        return RED, "RC-301", "aggregator returned nothing for default schedules"
    return GREEN, "RC-000", f"aggregated {len(DEFAULT_PROJECT_SCHEDULES)} default jobs"
 
 
def _chk_inventory() -> tuple:
    from backend.inventory_db import get_inventory_items
    required = ("id", "type", "l", "w", "h", "material")
    items = get_inventory_items()
    bad = [i.get("id", "?") for i in items if any(k not in i for k in required)]
    if bad:
        return RED, "RC-401", f"records missing required fields: {', '.join(map(str, bad))}"
    if not items:
        return AMBER, "RC-401", "inventory is empty"
    return GREEN, "RC-000", f"{len(items)} stock/remnant records valid"
 
 
def _chk_system() -> tuple:
    tmp = tempfile.gettempdir()
    probe = os.path.join(tmp, f".rome_probe_{os.getpid()}")
    with open(probe, "w") as f:
        f.write("ok")
    os.remove(probe)
    free_mb = shutil.disk_usage(tmp).free / 1e6
    notes = [f"temp writable, {free_mb:,.0f} MB free"]
    led, code = GREEN, "RC-000"
    if free_mb < MIN_FREE_DISK_MB:
        led, code = AMBER, "RC-502"
    try:
        import psutil  # optional
        rss = psutil.Process().memory_info().rss / 1e6
        notes.append(f"RSS {rss:,.0f} MB")
        if rss > RAM_LIMIT_MB and _LED_RANK[led] < _LED_RANK[AMBER]:
            led, code = AMBER, "RC-503"
    except ImportError:
        notes.append("psutil not installed (RAM not checked)")
    return led, code, "; ".join(notes)
 
 
def run_gateway_check(main_path: Optional[str] = None) -> Dict[str, Any]:
    """Run only the gateway import-contract check and log it (used by the
    fault harness to inject/repair a broken main.py without touching the repo)."""
    c = _check("gateway", lambda: _chk_gateway(main_path))
    lvl = {GREEN: "INFO", AMBER: "WARN", RED: "ERROR"}[c["led"]]
    log_event(lvl, c["code"], "selftest.gateway", c["detail"], led=c["led"])
    return c
 
 
def run_self_test() -> Dict[str, Any]:
    checks = [
        _check("deps", _chk_deps),
        _check("gateway", _chk_gateway),
        _check("cad", _chk_cad),
        _check("ocr", _chk_ocr),
        _check("aggregation", _chk_aggregation),
        _check("inventory", _chk_inventory),
        _check("system", _chk_system),
    ]
    overall = max((c["led"] for c in checks), key=lambda l: _LED_RANK[l])
    for c in checks:
        lvl = {GREEN: "INFO", AMBER: "WARN", RED: "ERROR"}[c["led"]]
        log_event(lvl, c["code"], f"selftest.{c['name']}", c["detail"], led=c["led"])
    return {"overall": overall, "checks": checks,
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}
 
 
# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def format_panel(report: Dict[str, Any]) -> str:
    dot = {GREEN: "(*) GREEN", AMBER: "(*) AMBER", RED: "(*) RED  "}
    lines = [f"ROME CABINETS DIAGNOSTIC PANEL      {report['ts']}",
             f"OVERALL: {dot[report['overall']]}", "-" * 78]
    for c in report["checks"]:
        lines.append(f"{dot[c['led']]}  {c['name']:<12} {c['code']}  {c['detail']}  [{c['ms']} ms]")
    return "\n".join(lines)
 
 
def main(argv: List[str]) -> int:
    if "--codes" in argv:
        for code, (title, hint) in ERROR_CODES.items():
            print(f"{code}  {title}\n        -> {hint}")
        return 0
    if "--explain" in argv:
        i = argv.index("--explain")
        code = argv[i + 1].upper() if len(argv) > i + 1 else ""
        if code not in ERROR_CODES:
            print(f"Unknown code '{code}'. Run --codes for the list.")
            return 2
        title, hint = ERROR_CODES[code]
        print(f"{code}  {title}\n  Fix: {hint}")
        recent = [e for e in tail(200) if e.get("code") == code][-3:]
        for ev in recent:
            print(f"  seen: {ev.get('ts')} [{ev.get('stage')}] {ev.get('msg')}")
        return 0
    if "--tail" in argv:
        n = int(argv[argv.index("--tail") + 1]) if len(argv) > argv.index("--tail") + 1 else 20
        for ev in tail(n):
            print(json.dumps(ev))
        return 0
    report = run_self_test()
    print(format_panel(report))
    return {GREEN: 0, AMBER: 1, RED: 2}[report["overall"]]
 
 
if __name__ == "__main__":
    if ROOT_DIR not in sys.path:
        sys.path.insert(0, ROOT_DIR)
    raise SystemExit(main(sys.argv[1:]))
 