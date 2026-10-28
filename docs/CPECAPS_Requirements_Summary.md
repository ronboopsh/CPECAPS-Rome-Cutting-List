# CPECAPS Capstone Requirements & Statistical Evaluation Summary
## Rome Cabinets — Automated Cutting List & Shop-Floor Coordinator

### 1. Capstone Quantitative Performance Targets
| Metric | Acceptance Target | Evaluation Method | Status |
| :--- | :--- | :--- | :--- |
| **CAD Dimension Accuracy** | $\ge 99.0\%$ | Ground-truth 3D bounding-box comparison | **PASSED** |
| **OCR Field Accuracy** | $\ge 90.0\%$ raw ($100\%$ post-review) | OpenCV morphological grid + EasyOCR + Human-in-the-Loop Modal | **PASSED** |
| **CAD Parsing Latency** | $< 1.0\text{ s}$ target ($< 5.0\text{ s}$ max) | $n=30$ repeated trials (`time.perf_counter`) | **PASSED** |
| **Multi-Project Aggregation Latency** | $< 1.0\text{ s}$ | $n=30$ repeated trials across 3 concurrent jobs | **PASSED** |
| **OCR Ingestion Latency** | $< 5.0\text{ s}$ | $n=30$ repeated trials | **PASSED** |
| **Peak CPU Utilization** | $< 30.0\%$ | $10\text{ Hz}$ `psutil` hardware profiler | **PASSED** |
| **Peak RAM Consumption** | $< 500.0\text{ MB}$ | $10\text{ Hz}$ `psutil` process RSS monitor | **PASSED** |
| **System Reliability** | $\ge 99.0\%$ pass rate | $100$ consecutive automated batch runs | **PASSED** |

### 2. Statistical Confidence Interval Formula
All continuous performance metrics report Sample Mean ($\bar{x}$), Sample Standard Deviation ($s$), Median, Min, Max, and the two-tailed $95\%$ Confidence Interval using Student's $t$-distribution ($df = n - 1 = 29, t_{0.025, 29} = 2.04523$):

$$\text{CI}_{95\%} = \bar{x} \pm t_{0.025, n-1} \cdot \left(\frac{s}{\sqrt{n}}\right)$$

### 3. Documented Test Exclusions
1. **Outlier Run 0:** Cold-start compilation and neural OCR weight initialization overhead excluded from steady-state confidence intervals.
2. **Damaged Test Sheet #17:** Torn/oil-stained paper cutlist accurately quarantined by the `<OcrReviewModal />` (`< 80%` cell confidence gate).
3. **Synthetic Malformed CAD Files:** Zero-thickness and non-manifold meshes halted by the pre-check geometry sanitizer in `backend/cad_parser.py`.
