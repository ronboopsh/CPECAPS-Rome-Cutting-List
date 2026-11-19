# Rome Cabinets – Diagnostics Guide

| Hardware idea | What this project uses | Where |
|---|---|---|
| Status LEDs | GREEN / AMBER / RED per subsystem | `python -m backend.diagnostics`, `GET /api/diagnostics/health`, `src/components/StatusLed.jsx` |
| Error codes | `RC-xxx` registry, shown in every API error as `[RC-xxx] message` | `backend/diagnostics.py` (`ERROR_CODES`), `python -m backend.diagnostics --codes` |
| Logs | JSON-lines, rotating (1 MB x 3) | `logs/rome_diag.jsonl` (override with `ROME_LOG_DIR`), `GET /api/diagnostics/logs` |
| Watchdog | Stage time limit; aborts the request and logs `RC-900` | `run_with_watchdog()` / `run_stage(..., timeout_s=)` |
| Latency budget | CAD/aggregation 1 s, OCR 5 s; slower runs log `RC-901` | `STAGE_BUDGET_S` |

## Reading the LEDs
* **GREEN** – check passed. **AMBER** – works but degraded (OCR on Tesseract fallback `RC-204`, low disk `RC-502`, RAM > 500 MB `RC-503`, optional package missing). **RED** – subsystem faulted; read the code.
* Command exit code: 0 = all green, 1 = amber, 2 = red (usable in CI / start-up scripts).
* Checks: `deps`, `gateway` (every `from backend.X import y` in `main.py` must exist), `cad` (sanitizer accepts good / rejects zero-thickness), `ocr` (engine present), `aggregation`, `inventory` (record schema), `system` (temp dir, disk, RSS).

## Reading a log line
`{"ts":"…","level":"ERROR","code":"RC-101","stage":"cad","msg":"ValueError: … component #3 …","duration_ms":0.17}`
`level` INFO/WARN/ERROR · `code` look up in the table · `stage` cad/ocr/aggregation/inventory/selftest.* · `duration_ms` stage time.
Useful: `python -m backend.diagnostics --tail 50`, or `grep '"level": "ERROR"' logs/rome_diag.jsonl`.

## Measuring MTTD / MTTR
`python3 tests/fault_injection.py` (add `--quick` for n=5). Results: `tests/logs/CPECAPS_Fault_Metrics.csv`, `CPECAPS_Fault_Summary.json`.
