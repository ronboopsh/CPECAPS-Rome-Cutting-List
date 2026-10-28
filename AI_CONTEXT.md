# Rome Cabinets — Automated Cutting List & Shop-Floor Coordinator
## Project Master Blueprint & AI Agent Operational Guidelines

> **Single Source of Truth:** This document (`PROJECT_CONTEXT.md`, mirrored at `AI_CONTEXT.md` and `CLAUDE.md`) governs all architectural, UI/UX, API, data schema, and statistical evaluation decisions for AI coding assistants (Antigravity, Claude, ChatGPT, Cursor) and human engineers working on this repository.

---

### 1. Executive Summary & Client Context
- **Client:** Rome Cabinets (Custom carpentry and bespoke cabinetry workshop founded by Rome Galvez).
- **Core Problem:** Transitioning from 3D designs to physical cut lists is manually done by hand, tedious ("nakakatamad"), and error-prone, causing production downtime.
- **Project Identity:** A web-based shop-floor coordinator that unifies 3D SketchUp CAD ingestion and physical paper cutlist OCR scanning, aggregates multi-project cutting lists, groups identical parts, sorts for table saw rip cuts, and manages sheet/scrap inventory.

---

### 2. October 24 Architectural Scope & Pivot (CRITICAL)
- **What We Are NOT Doing:** We are NOT building an autonomous 3D CAD generative design compiler from scratch, nor are we parsing proprietary closed `.skp` binaries. We do NOT have an interactive furniture template builder.
- **What We ARE Doing:**
  1. **Dual Input Ingestion:** Intermediate CAD meshes (`.dae`, `.obj`, `.csv`) + OCR paper cutlist photo scanning (`.png`, `.jpg`).
  2. **Multi-Project Aggregator:** Checkbox selection of multiple client jobs (e.g., Job #1 Kitchen, Job #2 Wardrobe, Job #3 Drawer Bank), merging identical parts, summing quantities.
  3. **Saw-Setup Rip Sorter:** Grouping parts by `Material -> Thickness -> Width Descending (W ↓)` so carpenters can make repetitive rip cuts without moving the table saw fence.
  4. **Human-in-the-Loop OCR Verification Modal:** Side-by-side scanned photo + editable table to catch OCR errors (`< 80%` confidence highlighted in soft yellow) before database commit.
  5. **Remnant/Scrap Inventory:** Matching viable scrap pieces (Hard constraints: exact thickness match, exact material, dimensions $\ge \text{part} + \text{kerf}$, area utilization $\ge 70\%$).
  6. **Printable Export:** ISO-compliant shop cut sheets in PDF (with checkboxes) and Excel (`.xlsx` / `.csv`).

---

### 3. Team Member Modules & File Ownership
- **Ron Galvez:** Computer Vision & OCR Pipeline (`backend/ocr_service.py`), Automated Benchmark Suite (`tests/benchmark_suite.py`).
- **Benjamin Torres:** CAD Parser & Geometry Sanitizer (`backend/cad_parser.py`), Multi-Project Aggregator (`backend/aggregator.py`), Inventory DB (`backend/inventory_db.py`).
- **Rene De Jesus:** Frontend UI Dashboard & Interactivity (`src/components/CuttingListTable.jsx`, `src/components/CabinetWireframe.jsx`, `src/components/ProjectTray.jsx`), User Documentation.
- **Pamela Calma:** API Router (`backend/main.py`), Human-in-the-Loop Modal (`src/components/OcrReviewModal.jsx`), Document Exporters (`src/utils/exporter.js`).

---

### 4. Canonical Data Schemas & API Contracts
- **Part Entity Schema (JSON):**
```json
{
  "id": "part-uuid",
  "project_id": "job-101",
  "part_name": "Base Cabinet Side",
  "quantity": 2,
  "length": 750.0,
  "width": 500.0,
  "thickness": 18.0,
  "material": "18mm Marine Plywood",
  "corner_cut": "None",
  "source": "CAD",
  "remarks": "Allocate to Stock Sheet #1"
}
```
  *(Note: `source` accepts `"CAD" | "OCR"`, and aggregated rows also carry `source_jobs: ["Job #1", "Job #2"]` for multi-project traceability.)*

- **API Endpoints:**
  - `POST /api/upload-cad`: Ingests `.dae` / `.obj` / `.csv`; returns normalized part array. Sanitizer halts on 0-thickness/non-manifold meshes.
  - `POST /api/upload-ocr`: Ingests `.png` / `.jpg`; runs OpenCV grid detection + EasyOCR; returns parsed cells with confidence scores.
  - `POST /api/aggregate`: Ingests `{"project_ids": [...]}`; returns consolidated parts sorted by `Material -> Thickness -> Width (Desc)`.
  - `GET /api/inventory` & `POST /api/inventory/match`: Queries stock and evaluates remnant scrap matches ($\ge 70\%$ utilization).

---

### 5. Measurable Capstone Evaluation Metrics & Acceptance Targets
- **CAD Dimension Accuracy:** $\ge 99\%$ match against ground-truth 3D models.
- **OCR Field Accuracy:** $\ge 90\%$ raw sheet recognition, $100\%$ post-human review.
- **Responsiveness (Latency):** $< 1.0\text{ s}$ target ($< 5.0\text{ s}$ threshold) for CAD parsing / aggregation; $< 5.0\text{ s}$ for OCR ingestion.
- **Hardware Power Consumption:** $< 30\%$ CPU, $< 500\text{ MB}$ RAM on standard PC (tested via `psutil` at $10\text{ Hz}$).
- **Reliability:** $\ge 99\%$ pass rate across 100 consecutive automated test runs.
- **Statistical Protocol:** Report $n$, repetitions, mean ($\bar{x}$), standard deviation ($s$), median, min, max, and 95% Confidence Interval using Student's $t$-distribution:
  $$\text{CI}_{95\%} = \bar{x} \pm t_{0.025, n-1} \cdot \left(\frac{s}{\sqrt{n}}\right)$$
- **Documented Exclusions:**
  1. Cold-start run 0 initialization (EasyOCR model loading overhead).
  2. Damaged/stained paper test sheet #17 (correctly caught by human review modal).
  3. Synthetically injected malformed CAD models (correctly halted by geometry sanitizer).

---

### 6. Design System & Theme Rules
- **Industrial Black & Yellow Theme (CAT / DeWalt inspired):**
  - Primary Dark: `#111827` (charcoal/black) and `#18181B`
  - Primary Accent Yellow: `#FACC15` / `#EAB308`
  - Two-tier navigation header (Utility strip + Branding banner).
  - Animated carpentry splash screen (`src/components/SplashScreen.jsx`) with flying tool outlines (`src/assets/tools/`) and Rome Modular Systems badge (`src/components/RomeLogo.jsx`).

---

### 7. Canonical Repository Directory Structure
```text
rome-cutting-list/
├── PROJECT_CONTEXT.md          <-- Master AI Context File
├── AI_CONTEXT.md               <-- Exact alias/duplicate for AI agents
├── CLAUDE.md                   <-- Exact copy/entry point for Claude
├── README.md                   <-- Human-facing project overview
├── package.json
├── vite.config.js
├── tailwind.config.js
├── index.html
│
├── src/                        <-- Frontend Web Application (React + Vite)
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── assets/                 <-- Logos, carpentry tool SVGs, icons
│   │   ├── logo.png
│   │   └── tools/
│   ├── components/             <-- Modular React UI Components
│   │   ├── Header.jsx          <-- Two-tier black & yellow header & unit toggle
│   │   ├── SplashScreen.jsx    <-- Flying carpentry tool intro animation
│   │   ├── UploadCard.jsx      <-- Dual CAD and OCR drag-and-drop zone
│   │   ├── CabinetWireframe.jsx<-- 3D technical line drawing with highlight sync
│   │   ├── CuttingListTable.jsx<-- Master interactive cutlist table
│   │   ├── ProjectTray.jsx     <-- Multi-project selector & rip sorter controls
│   │   ├── InventoryPanel.jsx  <-- Stock & scrap progress tracker
│   │   ├── OcrReviewModal.jsx  <-- Human-in-the-loop side-by-side verification
│   │   └── RomeLogo.jsx        <-- Official Rome Modular Systems vector badge
│   └── utils/                  <-- Frontend Utilities & Exporters
│       ├── aggregator.js       <-- Multi-job merge and rip-cut sort logic
│       ├── exporter.js         <-- PDF and Excel (.xlsx / .csv) export engines
│       └── api.js              <-- REST fetch client for FastAPI backend
│
├── backend/                    <-- Python FastAPI Backend Services
│   ├── main.py                 <-- FastAPI application & route gateway
│   ├── cad_parser.py           <-- Bounding-box extractor & geometry sanitizer
│   ├── ocr_service.py          <-- OpenCV grid detection + EasyOCR pipeline
│   ├── aggregator.py           <-- Backend cutlist grouping & rip sorter
│   ├── inventory_db.py         <-- SQLite/JSON remnant inventory storage
│   └── requirements.txt        <-- FastAPI, uvicorn, opencv-python, easyocr, trimesh
│
├── tests/                      <-- Capstone Testing & Benchmark Harness
│   ├── benchmark_suite.py      <-- psutil 10Hz profiler, latency timer & 95% CI calculator
│   ├── fixtures/               <-- Test CAD models (.obj, .dae) & paper cutlist photos
│   └── logs/                   <-- Generated CSV/log outputs (RESP_Test_*.csv, etc.)
│
└── docs/                       <-- Documentation & Capstone Submissions
    ├── CPECAPS_Requirements_Summary.md
    └── architecture/
```
