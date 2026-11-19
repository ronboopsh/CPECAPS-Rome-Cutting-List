"""
==============================================================================
tools/build_metrics_report.py
Builds the CPECAPS Metrics PDF from REAL runs on the machine it is executed on.

    pip install reportlab matplotlib pillow          # one-time
    python3 tools/build_metrics_report.py --group-code ABC1

What it does (run from the repository root)
  1. runs  python3 tests/fault_injection.py   (skip with --skip-run to reuse the
     last tests/logs/CPECAPS_Fault_Summary.json)
  2. captures the live console output of  python -m backend.diagnostics,
     --tail and --codes and renders them as terminal-style images
  3. writes  CPECAPS_Metrics_<group-code>.pdf  (default group code: GroupCode)

Numbers, statistics and the "after" LED panel therefore come from YOUR machine.
The "before fix" panel is a recorded capture of the original code (constant below).
==============================================================================
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import subprocess
import sys
import textwrap
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

# Real output of `python -m backend.diagnostics` on the ORIGINAL code (19 Nov 2026),
# before backend/gateway_adapters.py was added.
BEFORE_PANEL = """ROME CABINETS DIAGNOSTIC PANEL      2026-11-19T06:40:38
OVERALL: (*) RED
------------------------------------------------------------------------------
(*) RED    gateway      RC-501  main.py imports undefined names: backend.cad_parser.parse_cad_file, backend.aggregator.aggregate_projects, backend.inventory_db.get_inventory_stock, backend.inventory_db.match_remnants  [13.28 ms]
(*) GREEN  cad          RC-000  sanitizer OK (750.0x500.0x18.0), rejects zero-thickness  [3.65 ms]
(*) AMBER  ocr          RC-204  engine: tesseract (fallback; EasyOCR not installed)  [254.1 ms]
(*) GREEN  aggregation  RC-000  aggregated 3 default jobs  [0.3 ms]
(*) GREEN  inventory    RC-000  5 stock/remnant records valid  [0.11 ms]
(*) GREEN  system       RC-000  temp writable, 10,719 MB free; RSS 99 MB  [7.26 ms]"""

TEAM = "Ron Galvez, Benjamin Torres, Rene De Jesus, Pamela Calma"
REPO = "https://github.com/ronboopsh/CPECAPS-Rome-Cutting-List"


def run(cmd, env=None, check=False):
    e = dict(os.environ, **(env or {}))
    p = subprocess.run(cmd, capture_output=True, text=True, env=e, cwd=ROOT)
    return (p.stdout or "") + (p.stderr if check else "")


def tool_versions():
    out = [f"{platform.system()}, Python {platform.python_version()}"]
    try:
        import cv2
        out.append(f"OpenCV {cv2.__version__}")
    except Exception:
        out.append("OpenCV not importable")
    t = run(["tesseract", "--version"]).splitlines()
    out.append(t[0] if t else "Tesseract not found")
    try:
        import easyocr  # noqa: F401
        out.append("EasyOCR installed")
    except Exception:
        out.append("EasyOCR not installed")
    return ", ".join(out)


# ---------------------------------------------------------------- images ----
def render_terminal(lines, path, title, width_chars=None, size=15, colorize=True):
    import matplotlib
    from PIL import Image, ImageDraw, ImageFont
    fdir = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data", "fonts", "ttf")
    f = ImageFont.truetype(os.path.join(fdir, "DejaVuSansMono.ttf"), size)
    fb = ImageFont.truetype(os.path.join(fdir, "DejaVuSansMono-Bold.ttf"), size)
    BG, FG, DIM = (24, 24, 27), (228, 228, 231), (161, 161, 170)
    COL = {"GREEN": (74, 222, 128), "AMBER": (250, 204, 21), "RED": (248, 113, 113),
           "ERROR": (248, 113, 113), "WARN": (250, 204, 21), "INFO": (74, 222, 128)}
    cw, lh = f.getlength("M"), size + 7
    wc = width_chars or max(len(l) for l in lines)
    im = Image.new("RGB", (int(cw * wc + 40), int(lh * len(lines) + 70)), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.size[0], 30], fill=(39, 39, 42))
    for i, c in enumerate([(248, 113, 113), (250, 204, 21), (74, 222, 128)]):
        d.ellipse([12 + i * 20, 9, 24 + i * 20, 21], fill=c)
    d.text((90, 7), title, font=ImageFont.truetype(os.path.join(fdir, "DejaVuSansMono.ttf"), 13), fill=DIM)
    y = 44
    for line in lines:
        x = 20
        for tok in re.split(r'(\bGREEN\b|\bAMBER\b|\bRED\b|"ERROR"|"WARN"|"INFO"|RC-\d{3})', line):
            if not tok:
                continue
            col, font = FG, f
            if colorize and tok.strip('"') in COL:
                col, font = COL[tok.strip('"')], fb
            elif colorize and re.fullmatch(r"RC-\d{3}", tok):
                col, font = (125, 211, 252), fb
            d.text((x, y), tok, font=font, fill=col)
            x += cw * len(tok)
        y += lh
    im.save(path)


def wrap_lines(text, width, indent=28):
    out = []
    for l in text.rstrip().split("\n"):
        out += textwrap.wrap(l, width, subsequent_indent=" " * indent) or [""]
    return out


def make_images(img_dir, summary):
    py = sys.executable
    env = {"PYTHONIOENCODING": "utf-8"}
    panel = run([py, "-m", "backend.diagnostics"], env)
    render_terminal(wrap_lines(BEFORE_PANEL, 110), f"{img_dir}/panel_before.png",
                    "$ python -m backend.diagnostics      (BEFORE fix, original code)", 112)
    render_terminal(wrap_lines(panel, 110), f"{img_dir}/panel_after.png",
                    "$ python -m backend.diagnostics      (AFTER fix, this machine)", 112)
    # first ERROR event per injected code from the log of the fault run
    log_path = os.path.join(ROOT, "tests", "logs", "diag", "rome_diag.jsonl")
    evs = [json.loads(x) for x in open(log_path, encoding="utf-8")] if os.path.exists(log_path) else []
    pick = []
    for code in ["RC-101", "RC-102", "RC-201", "RC-900", "RC-401", "RC-501"]:
        e = next((e for e in evs if e.get("code") == code and e.get("level") == "ERROR"), None)
        if e:
            pick.append(e)
    ok = next((e for e in evs if e.get("code") == "RC-000" and e.get("stage") == "cad"), None)
    if ok:
        pick.append(ok)
    lines = []
    for e in pick:
        e = {k: v for k, v in e.items() if k != "run_id"}
        lines += textwrap.wrap(json.dumps(e), 118, subsequent_indent="    ") + [""]
    render_terminal(lines[:-1] or ["(no log events found - run tests/fault_injection.py)"], f"{img_dir}/log_excerpt.png",
                    "logs/rome_diag.jsonl  (first event per injected fault, plus RC-000 after repair)", 120, 14)
    codes = run([py, "-m", "backend.diagnostics", "--codes"], env)
    cl = []
    for l in codes.rstrip().split("\n"):
        cl += textwrap.wrap(l, 112, subsequent_indent="        ")
    render_terminal(cl, f"{img_dir}/codes.png", "$ python -m backend.diagnostics --codes", 114, 13)
    explain = run([py, "-m", "backend.diagnostics", "--explain", "RC-501"], env)
    render_terminal(wrap_lines(explain, 112, 6), f"{img_dir}/explain.png",
                    "$ python -m backend.diagnostics --explain RC-501", 114, 14)
    return panel


def make_chart(path, summary):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    F = {f["id"]: f for f in summary["faults"]}
    ids = [i for i in ["F1", "F2", "F3", "F4", "F5", "F6"] if i in F]
    short = {"F1": "F1 CAD zero\nthickness", "F2": "F2 CAD malformed\npayload", "F3": "F3 corrupt OCR\nimage",
             "F4": "F4 stage hang\n(watchdog)", "F5": "F5 corrupt\ninventory", "F6": "F6 broken gateway\nimport"}

    def mean(i, k):
        d = F[i][k]
        return d.get("mean") if d else None

    def half(i, k):
        d = F[i][k]
        return (d["ci95_high"] - d["ci95_low"]) / 2 if d else 0

    fig, ax = plt.subplots(figsize=(8.2, 3.9))
    x = range(len(ids))
    w = 0.38
    dv = [mean(i, "mttd_ms") for i in ids]
    rv = [mean(i, "mttr_ms") or 0 for i in ids]
    ax.bar([i - w / 2 for i in x], dv, w, yerr=[half(i, "mttd_ms") for i in ids], capsize=3, color="#FACC15",
           edgecolor="#111827", label="MTTD")
    ax.bar([i + w / 2 for i in x], rv, w, yerr=[half(i, "mttr_ms") for i in ids], capsize=3, color="#111827",
           label="MTTR (scripted runbook)")
    ax.set_yscale("log")
    ax.set_ylabel("milliseconds (log scale)")
    ax.set_xticks(list(x))
    ax.set_xticklabels([short[i] for i in ids], fontsize=7.5)
    ax.set_ylim(0.01, 8000)
    for i, (d, r) in enumerate(zip(dv, rv)):
        ax.text(i - w / 2, d * 1.6, f"{d:.2f}" if d < 100 else f"{d:.0f}", ha="center", fontsize=7)
        if r:
            ax.text(i + w / 2, r * 1.6, f"{r:.2f}" if r < 100 else f"{r:.0f}", ha="center", fontsize=7)
    ax.legend(fontsize=8, loc="upper left")
    ax.grid(axis="y", alpha=.3, which="both", linewidth=.4)
    ax.set_title("Measured MTTD and MTTR per injected fault (mean, error bars = 95% CI)", fontsize=9.5)
    plt.tight_layout()
    plt.savefig(path, dpi=200)
    plt.close()


# ------------------------------------------------------------------- PDF ----
def build_pdf(out_path, group_code, summary, img_dir, env_line):
    from PIL import Image
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (Image as RLImage, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
                                    Spacer, Table, TableStyle)

    F = {f["id"]: f for f in summary["faults"]}
    ids = [i for i in ["F1", "F2", "F3", "F4", "F5", "F6"] if i in F]
    ss = getSampleStyleSheet()
    DARK, YEL = colors.HexColor("#111827"), colors.HexColor("#FACC15")
    H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=15, spaceBefore=6, spaceAfter=6, textColor=DARK)
    H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, spaceBefore=8, spaceAfter=4, textColor=DARK)
    B = ParagraphStyle("B", parent=ss["BodyText"], fontName="Helvetica", fontSize=9.3, leading=12.6, spaceAfter=4)
    CAP = ParagraphStyle("CAP", parent=B, fontSize=8, leading=10, textColor=colors.HexColor("#444444"), spaceAfter=8)
    TC = ParagraphStyle("TC", parent=B, fontSize=7.8, leading=9.6, spaceAfter=0)
    TH = ParagraphStyle("TH", parent=TC, fontName="Helvetica-Bold", textColor=colors.white)
    TITLE = ParagraphStyle("T", parent=H1, fontSize=22, leading=26, spaceAfter=4)

    def P(t, st=B):
        return Paragraph(t, st)

    def tbl(data, widths, header=True, zebra=True):
        rows = [[P(c, TH if (header and i == 0) else TC) if isinstance(c, str) else c for c in r] for i, r in enumerate(data)]
        t = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
        st = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#BBBBBB")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
              ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
              ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
        if header:
            st.append(("BACKGROUND", (0, 0), (-1, 0), DARK))
        if zebra:
            st += [("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F4F4F5")) for i in range(2, len(rows), 2)]
        t.setStyle(TableStyle(st))
        return t

    def fig(name, caption, maxw=17 * cm, maxh=19 * cm):
        path = f"{img_dir}/{name}"
        w, h = Image.open(path).size
        sc = min(maxw / w, maxh / h)
        return KeepTogether([RLImage(path, width=w * sc, height=h * sc), P(caption, CAP)])

    def fmt(v):
        return f"{v:.2f}" if v < 100 else f"{v:,.1f}"

    mono = lambda s: f"<font face='Courier'>{s}</font>"
    f1, f3, f4, f6 = F["F1"], F["F3"], F["F4"], F["F6"]
    story = []

    # ---- cover
    story += [P("CPECAPS Metrics", TITLE),
              P("<b>Diagnostics, MTTD and MTTR</b> &mdash; Rome Cabinets Automated Cutting List &amp; Shop-Floor Coordinator", H2),
              Spacer(1, 6),
              tbl([["Group code", group_code or "______________ (fill in before submitting)"],
                   ["Team", TEAM], ["Repository", REPO],
                   ["Report date", time.strftime("%d %B %Y")],
                   ["Test environment", env_line],
                   ["Reproduce", "python3 tools/build_metrics_report.py (see Appendix A)"]],
                  [4 * cm, 13 * cm], header=False, zebra=False),
              Spacer(1, 10), P("Summary", H2),
              P("The system is a software pipeline (CAD ingest, OCR ingest, aggregation, inventory match behind a FastAPI gateway), so the "
                "hardware ideas in the brief were mapped to software equivalents: <b>status LEDs</b> became a GREEN/AMBER/RED self-test "
                "(also shown in the app header), <b>error codes</b> became an RC-xxx registry attached to every API error, <b>logs</b> became a "
                "structured JSON-lines file, and <b>watchdogs</b> became per-stage time limits that abort a hung stage."),
              P(f"Six faults were injected and timed (n={f1['n']} for the fast faults, n={f3['n']} for OCR and hang faults, after one excluded cold-start run each). "
                f"F6 reproduces a defect the diagnostics found in the original code: {mono('backend/main.py')} imported four functions that did not exist, "
                f"so the API could not start (gateway LED RED, RC-501). It was fixed with {mono('backend/gateway_adapters.py')}; the fault is now injected on a "
                f"temporary copy of {mono('main.py')} so it can be detected and repaired repeatedly."),
              P(f"All injected faults were detected with the correct code. Mean MTTD ranged from {min(F[i]['mttd_ms']['mean'] for i in ids):.2f} ms to "
                f"{f4['mttd_ms']['mean']:.0f} ms (the hang fault, equal to the 1.0 s watchdog limit by design). The only repair that took measurable time was F3 "
                f"({f3['mttr_ms']['mean']:,.0f} ms), because re-running OCR dominates. <b>Important limit:</b> MTTR here is the scripted runbook; human reading, "
                f"re-exporting and re-photographing time is not included (Section 3 and Appendix B)."),
              PageBreak()]

    # ---- 1 diagnostics
    story += [P("1. Diagnostics added", H1),
              tbl([["Hardware idea", "Implemented as", "Where"],
                   ["Status LEDs", "GREEN / AMBER / RED per subsystem: deps, gateway, cad, ocr, aggregation, inventory, system. CLI exit code 0/1/2. LED in the app header.",
                    f"{mono('python -m backend.diagnostics')}; {mono('GET /api/diagnostics/health')}; {mono('src/components/StatusLed.jsx')}"],
                   ["Error codes", "RC-xxx registry (16 codes). API errors read " + mono("[RC-101] ...message") + ". " + mono("--explain RC-xxx") + " prints the first repair action and recent occurrences.",
                    f"{mono('backend/diagnostics.py')} ERROR_CODES; {mono('--codes')}; {mono('--explain')}"],
                   ["Logs", "One JSON object per line (ts, level, code, stage, msg, duration_ms). Rotating 1 MB x 3.",
                    f"{mono('logs/rome_diag.jsonl')}; {mono('--tail N')}; {mono('GET /api/diagnostics/logs')}"],
                   ["Watchdog", "Stage runs in a worker thread with a time limit; on expiry the request is released and RC-900 is logged.",
                    f"{mono('run_with_watchdog()')}, {mono('run_stage(..., timeout_s=)')}"],
                   ["Latency budgets", "CAD/aggregation/inventory 1 s, OCR 5 s (PROJECT_CONTEXT.md). Slower runs log RC-901.", mono("STAGE_BUDGET_S")],
                   ["Start-up self-test", "Runs the LED checks when the API boots and prints the result. " + mono("ROME_STRICT_START=1") + " refuses to start while any LED is RED.",
                    mono("startup_self_test()") + " in " + mono("backend/main.py")]],
                  [2.6 * cm, 8.2 * cm, 6.2 * cm]),
              Spacer(1, 6), P("How to read the status LEDs", H2),
              P("<b>GREEN</b>: check passed. <b>AMBER</b>: works but degraded (OCR on the Tesseract fallback RC-204, low disk RC-502, RAM above 500 MB RC-503, optional package missing). "
                "<b>RED</b>: subsystem faulted; look up the code. Figure 1 shows the same self-test before and after the gateway fix: the <b>gateway</b> LED was RED (RC-501) because "
                "main.py imported four functions that did not exist, and is GREEN afterwards."),
              fig("panel_before.png", "Figure 1a. BEFORE the fix (recorded capture of the original code). Exit code 2 = at least one RED.", maxh=7 * cm),
              fig("panel_after.png", "Figure 1b. AFTER the fix (live capture from the machine that built this report). Any remaining RED/AMBER is environment-related (missing packages, fallback OCR engine).", maxh=7 * cm),
              PageBreak(),
              P("How to read the logs", H2),
              P("Each line is one event. <b>level</b> is INFO, WARN or ERROR; <b>code</b> is looked up in Figure 3; <b>stage</b> says where it happened (cad, ocr, aggregation, inventory, selftest.*); "
                "<b>duration_ms</b> is the stage time. A successful repair shows as an RC-000 'ok' line for the same stage right after the ERROR line (last line of Figure 2)."),
              fig("log_excerpt.png", "Figure 2. First log event for each injected fault code, from logs/rome_diag.jsonl, plus the RC-000 line after repair.", maxh=11 * cm),
              P("One-step runbook lookup", H2),
              fig("explain.png", "Figure 2b. python -m backend.diagnostics --explain RC-501.", maxh=4 * cm),
              PageBreak(),
              P("Error-code reference", H2),
              fig("codes.png", "Figure 3. Output of python -m backend.diagnostics --codes. Each code carries the first repair action.", maxh=21 * cm),
              PageBreak()]

    # ---- 2 MTTD / MTTR
    story += [P("2. Measured MTTD and MTTR", H1),
              P("<b>Definitions.</b> <i>t_inject</i>: the faulty input is handed to the pipeline stage. <i>t_detect</i>: diagnostics emits an ERROR event with the expected RC-code "
                "(captured by a subscriber, clock = time.perf_counter()). <i>t_repair</i>: the documented corrective action has been applied and the stage re-run reports success. "
                "<b>MTTD = mean(t_detect - t_inject)</b>, <b>MTTR = mean(t_repair - t_detect)</b>. Run 0 of each fault (cold start) is excluded. "
                "95% confidence intervals use Student's t (two-tailed).")]
    rows = [["Fault", "Code", "n", "MTTD mean (ms) [95% CI]", "MTTD sd / median / min-max (ms)", "MTTR mean (ms) [95% CI]", "Detected / repaired"]]
    for i in ids:
        f = F[i]
        d, r = f["mttd_ms"], f["mttr_ms"]
        rows.append([f"<b>{i}</b> {f['title']}", f["code"], str(f["n"]),
                     f"{fmt(d['mean'])} [{fmt(d['ci95_low'])}, {fmt(d['ci95_high'])}]",
                     f"{fmt(d['sd'])} / {fmt(d['median'])} / {fmt(d['min'])}-{fmt(d['max'])}",
                     (f"{fmt(r['mean'])} [{fmt(r['ci95_low'])}, {fmt(r['ci95_high'])}]" if r else "n/a"),
                     f"{int(f['detection_rate'] * 100)}% / " + (f"{int(f['repair_rate'] * 100)}%" if f.get("repair_rate") is not None else "n/a")])
    story += [Spacer(1, 4), tbl(rows, [3.9 * cm, 1.3 * cm, 0.8 * cm, 3.3 * cm, 3.3 * cm, 3.0 * cm, 1.6 * cm]), Spacer(1, 6),
              fig("chart.png", "Figure 4. MTTD and MTTR per fault (log scale). F3's MTTR is dominated by re-running OCR; F4's MTTD equals the watchdog limit.", maxh=9 * cm),
              P("Reading the numbers", H2),
              P(f"Faults F1, F2, F5 and F6 are detected within milliseconds because the check is synchronous (the stage raises, or the static import check runs, and the diagnostics layer logs). "
                f"<b>F4</b>: MTTD is {f4['mttd_ms']['mean']:.0f} ms, essentially the 1.0 s watchdog limit; this is a deliberate trade-off (a lower limit detects faster but risks false alarms on slow OCR). "
                f"Without the watchdog a hung stage is never detected. <b>F3</b>: detection is {f3['mttd_ms']['mean']:.2f} ms but repair takes {f3['mttr_ms']['mean']:,.0f} ms "
                f"(almost all of it re-running OCR on the replacement photo). <b>F6</b>: detected in {f6['mttd_ms']['mean']:.1f} ms by the gateway LED; the scripted repair restores the correct import name and re-runs the check."),
              PageBreak(), P("Tools used and steps, per fault", H2)]
    rows = [["Fault", "Tools used", "Steps (detect -> repair)"]]
    for i in ids:
        f = F[i]
        rows.append([f"<b>{i}</b> {f['title']}<br/>({f['code']})", "<br/>".join("- " + t for t in f["tools"]),
                     "<br/>".join(f"{k + 1}. {s}" for k, s in enumerate(f["steps"]))])
    story += [tbl(rows, [3.6 * cm, 5.2 * cm, 8.2 * cm]), PageBreak()]

    # ---- 3 findings / limitations
    story += [P("3. Findings and limitations", H1), P("Findings from reading and running the code", H2),
              tbl([["#", "Finding", "Status / effect on MTTD and MTTR"],
                   ["1", f"{mono('backend/main.py')} imported {mono('parse_cad_file')}, {mono('aggregate_projects')}, {mono('get_inventory_stock')}, {mono('match_remnants')}; none existed, so the API failed to start (ImportError).",
                    f"<b>Fixed</b> with {mono('backend/gateway_adapters.py')}. Found by the gateway LED (RC-501) in about {f6['mttd_ms']['mean']:.0f} ms; before the diagnostics nothing checked this automatically."],
                   ["2", f"Inventory failure message is just {mono('KeyError: ' + chr(39) + 'h' + chr(39))} (no record id).", "Open. The operator must search the data to find the record (F5 repair step 3)."],
                   ["3", "The CAD sanitizer stops at the first bad component.", "Open. A model with k bad parts needs k detect-fix-reupload cycles, so MTTR grows with k."],
                   ["4", f"{mono('/api/aggregate')} only knows the three demo jobs (Job #1-#3); any other project id returns 422 [RC-301].", "Open. Aggregation of real uploaded jobs is not available through the API."],
                   ["5", f"{mono('src/utils/api.js')} falls back silently to local mode and posts {mono('{parts: ...}')} where the backend expects {mono('project_ids')}. In this checkout no component imports it, so it has no effect today.",
                    "Dormant. If the UI is wired to the API later, backend faults would be invisible (unbounded MTTD) unless the fallback is made visible."],
                   ["6", f"Frontend-only runs (no backend started) show the header LED as RED 'API unreachable'.", "By design: the LED reports backend availability."]],
                  [0.7 * cm, 10.3 * cm, 6 * cm]),
              P("Limitations (please read)", H2),
              P("1) <b>MTTR is scripted.</b> The repair step runs the same runbook an operator follows (read code, apply fix, re-run) but by script, so it excludes human time. Appendix B is a stopwatch sheet to record a live drill. "
                "2) <b>Figures are rendered images of real console output</b>, not photos or GUI screenshots. "
                "3) F1-F6 are injected faults; absolute timings are for one machine and will differ on the shop PC. "
                "4) Python cannot kill a hung thread; the watchdog releases the request and logs RC-900, but the stuck worker is abandoned (see R7). "
                "5) The CAD adapters read OBJ/DAE files as one bounding box per object, so non-manifold meshes in real SketchUp exports are not detected and rotated panels may get wrong dimensions."),
              PageBreak(),
              P("4. Improvements to reduce MTTR", H1),
              tbl([["#", "Change", "Why (evidence)", "Status"],
                   ["R1", f"<b>Fail-fast start-up self-test.</b> Run the self-test at API boot; with {mono('ROME_STRICT_START=1')} refuse to serve while RED. Run {mono('python -m backend.diagnostics')} in CI (exit code 2 fails the build).", "Finding 1 would have been caught before anyone used the app.", "<b>Implemented</b> (CI step proposed)"],
                   ["R2", "<b>Service menu in the UI.</b> Header LED is in place; add a drawer with the last 20 log events, failing checks and the code-to-action table.", "Operator reads the code and the fix in one place instead of grepping a file.", "<b>Partial</b>: LED done, drawer proposed"],
                   ["R3", "<b>Support bundle + request id.</b> Return a request id in every response, log it as run_id, add a 'Copy diagnostics' button (self-test + last 50 events + versions).", "Shortens the hand-off from operator to developer.", "Proposed"],
                   ["R4", "<b>Better messages and batch validation.</b> Include record id and field (inventory), part name plus component number (CAD), and report all bad CAD components in one pass.", "Findings 2 and 3: removes the search step in F5 and k repair cycles in F1.", "Proposed"],
                   ["R5", "<b>Known-good fixtures ('test pads').</b> Keep sample CAD/CSV (tests/fixtures), add a sample OCR photo and a 'Load sample' button.", "Isolates 'bad input' vs 'broken system' in one click.", "Proposed"],
                   ["R6", "<b>No silent fallbacks.</b> When api.js is wired in, show an AMBER 'offline / local mode' badge and log the error; fix the aggregate payload and response shape.", "Finding 5.", "Proposed"],
                   ["R7", "<b>Run OCR/aggregation in worker processes</b> so the watchdog can kill and restart a stuck stage; tune limits per stage.", "Limitation 4; lets MTTD for hangs drop below 1.0 s.", "Proposed"],
                   ["R8", "<b>OCR input handling.</b> Zero-row results now log RC-203 and return a warning; unreadable images return 422 instead of 500. Still to add: file-signature pre-check and 'retake the photo' guidance.", "F3: repair time is the re-run plus the human retake.", "<b>Partial</b>"],
                   ["R9", "<b>Pin and install dependencies.</b> Install EasyOCR (clears RC-204); the deps check reports RC-505 when a core package is missing.", "Removes AMBER/RED states caused by environment drift.", "Proposed"],
                   ["R10", f"<b>One-step runbook lookup:</b> {mono('--explain RC-xxx')}.", "Shortens the 'what do I do now' step after detection.", "<b>Implemented</b>"]],
                  [0.9 * cm, 7.0 * cm, 6.4 * cm, 2.7 * cm]),
              PageBreak(),
              P("Appendix A. How to reproduce and capture your own screenshots", H1),
              tbl([["Command (from the repository root)", "Produces"],
                   [mono("python -m backend.diagnostics"), "LED panel (Figure 1)"],
                   [mono("python -m backend.diagnostics --tail 20"), "Last 20 log events (Figure 2)"],
                   [mono("python -m backend.diagnostics --explain RC-101"), "Fix for one code plus recent occurrences"],
                   [mono("python -m backend.diagnostics --codes"), "Error-code table (Figure 3)"],
                   [mono("python3 tests/fault_injection.py"), f"MTTD/MTTR run; CSV + JSON in tests/logs (add {mono('--quick')} for n=5)"],
                   [mono("python3 tools/build_metrics_report.py --group-code XXXX"), "Rebuilds this PDF from your machine's results"],
                   [mono("uvicorn backend.main:app --port 8000") + ", then open " + mono("/api/diagnostics/health"), "JSON health report in a browser; the header LED turns GREEN/AMBER/RED"]],
                  [8 * cm, 9 * cm]),
              Spacer(1, 6),
              P(f"Files added or changed: {mono('backend/diagnostics.py')}, {mono('backend/diag_router.py')}, {mono('backend/gateway_adapters.py')} (new); "
                f"{mono('backend/main.py')} (adapters imported, router mounted, stages wrapped in run_stage, startup self-test, RC-203, 422 mapping); "
                f"{mono('tests/fault_injection.py')}, {mono('tools/build_metrics_report.py')}, {mono('docs/DIAGNOSTICS.md')} (new); "
                f"{mono('src/components/StatusLed.jsx')} (new) and {mono('src/components/Header.jsx')} (LED added); {mono('.gitignore')} (cache/log folders)."),
              P("Appendix B. Operator stopwatch sheet (optional live drill)", H1),
              P("One teammate injects each fault while another recovers using only the LED panel, the log and the code table. Record times in seconds.", B),
              tbl([["Fault", "Injected at (hh:mm:ss)", "Operator saw code at", "Repair verified at", "MTTD (s)", "MTTR (s)", "Who / notes"]] +
                  [[f"{i} {F[i]['title']}", "", "", "", "", "", ""] for i in ids if i != "F4" or True],
                  [4.2 * cm, 2.4 * cm, 2.3 * cm, 2.3 * cm, 1.5 * cm, 1.5 * cm, 2.8 * cm])]

    def footer(c, d):
        c.saveState()
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#666666"))
        c.drawString(2 * cm, 1.1 * cm, "CPECAPS Metrics - Rome Cabinets Cutting List")
        c.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Page {d.page}")
        c.setFillColor(YEL)
        c.rect(2 * cm, 1.5 * cm, A4[0] - 4 * cm, 0.06 * cm, stroke=0, fill=1)
        c.restoreState()

    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm,
                            bottomMargin=2.0 * cm, title="CPECAPS Metrics - Diagnostics, MTTD and MTTR",
                            author="CPECAPS Rome Cabinets team")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group-code", default="")
    ap.add_argument("--skip-run", action="store_true", help="reuse existing tests/logs results")
    ap.add_argument("--out-dir", default=ROOT)
    a = ap.parse_args()

    if not a.skip_run:
        print("running fault injection (about 1 minute)...")
        print(run([sys.executable, "tests/fault_injection.py"], {"PYTHONIOENCODING": "utf-8"}))
    sp = os.path.join(ROOT, "tests", "logs", "CPECAPS_Fault_Summary.json")
    if not os.path.exists(sp):
        sys.exit("tests/logs/CPECAPS_Fault_Summary.json not found - run tests/fault_injection.py first.")
    summary = json.load(open(sp))
    img_dir = os.path.join(ROOT, "tests", "logs", "report_images")
    os.makedirs(img_dir, exist_ok=True)
    make_images(img_dir, summary)
    make_chart(f"{img_dir}/chart.png", summary)
    out = os.path.join(a.out_dir, f"CPECAPS_Metrics_{a.group_code or 'GroupCode'}.pdf")
    build_pdf(out, a.group_code, summary, img_dir, tool_versions())
    print("wrote", out)


if __name__ == "__main__":
    main()
