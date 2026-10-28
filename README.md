# Rome Cabinets — Automated Cutting List & Shop-Floor Coordinator

> **Industrial CNC · CAD · OCR Shop-Floor Coordinator (v2.5)**  
> Bespoke cabinetry cutlist automation, multi-project part consolidation, table-saw rip-cut sorting, OpenCV + EasyOCR paper cutlist intake with human-in-the-loop verification, and 70%-utilization remnant scrap matching.

---

## Quick Start

### 1. Frontend Web Application (Vite + React + Tailwind CSS)
```bash
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

### 2. Python FastAPI Backend (`backend/`)
```bash
pip install -r backend/requirements.txt
python3 backend/main.py
```

### 3. Capstone Automated Benchmark & Statistical Evaluation Suite (`tests/`)
```bash
python3 tests/benchmark_suite.py
```
Generates `tests/logs/RESP_Test_BatchRuns.csv` (and root `RESP_Test_BatchRuns.csv`) with 10 Hz `psutil` hardware telemetry and two-tailed Student's $t$-distribution 95% confidence intervals ($\text{CI}_{95\%} = \bar{x} \pm t_{0.025, n-1} \cdot \frac{s}{\sqrt{n}}$).

---

## Core Modules & Team Ownership

| Engineer | Module Ownership | Key Files |
| :--- | :--- | :--- |
| **Ron Galvez** | Computer Vision & OCR Pipeline, Automated Benchmark Suite | `backend/ocr_service.py`, `tests/benchmark_suite.py` |
| **Benjamin Torres** | CAD Parser & Geometry Sanitizer, Multi-Project Aggregator, Inventory DB | `backend/cad_parser.py`, `backend/aggregator.py`, `backend/inventory_db.py` |
| **Rene De Jesus** | Frontend UI Dashboard & Interactivity, User Documentation | `src/components/CuttingListTable.jsx`, `src/components/CabinetWireframe.jsx`, `src/components/ProjectTray.jsx` |
| **Pamela Calma** | FastAPI Gateway Router, Human-in-the-Loop Modal, Document Exporters | `backend/main.py`, `src/components/OcrReviewModal.jsx`, `src/utils/exporter.js` |

For full architectural rules, data schemas, API contracts, and capstone evaluation metrics, see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) (mirrored at [`AI_CONTEXT.md`](./AI_CONTEXT.md) and [`CLAUDE.md`](./CLAUDE.md)).
