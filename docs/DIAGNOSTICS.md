# Rome Cabinets – Diagnostics Guide

| Hardware idea | What this project uses | Where |
|---|---|---|
| Status LEDs | GREEN / AMBER / RED per subsystem | `python -m backend.diagnostics`, `GET /api/diagnostics/health`, `src/components/StatusLed.jsx` |
| Error codes | `RC-xxx` registry, shown in every API error as `[RC-xxx] message` | `backend/diagnostics.py` (`ERROR_CODES`), `python -m backend.diagnostics --codes` |
| Logs | JSON-lines, rotating (1 MB x 3) | `logs/rome_diag.jsonl` (override with `ROME_LOG_DIR`), `GET /api/diagnostics/logs` |
| Startup self-test | Runs the LED checks at API boot; `ROME_STRICT_START=1` refuses to start while any LED is RED | `startup_self_test()` in `backend/main.py` |
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

## Looking up a code fast
`python -m backend.diagnostics --explain RC-101` prints the title, the first repair action, and the last 3 times that code appeared in the log.

## Which codes are emitted at run time vs only by the self-test
| Runtime (API request) | Self-test / LED panel only |
|---|---|
| RC-101, 102, 201, 202, 203 (warning in OCR response), 301, 401, 900, 901 | RC-204, 501, 502, 503, 505 |

## Fault injection (F1-F6)
F6 (gateway import contract) now injects a broken copy of `main.py` in a temp dir and repairs it, so it measures MTTR as well as MTTD and keeps working after the shipped `main.py` was fixed.

## Changes made to cut MTTR (and the fault they address)
* `backend/gateway_adapters.py` + corrected imports in `main.py`: the API could not start (RC-501). Found by the gateway LED.
* Startup self-test with optional strict mode: a RED subsystem is seen at boot, not at the first failing request.
* `RC-203` is now logged and returned as `warning` when OCR reads an image but finds 0 rows.
* Unreadable OCR image and unknown project ids return HTTP 422 with the `[RC-xxx]` code instead of a generic 500.
* `StatusLed` is shown in the header, so the LED is visible without opening the API.
* `--explain` CLI command for a one-step runbook lookup.