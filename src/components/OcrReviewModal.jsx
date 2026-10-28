import React, { useState } from 'react'
import {
  Camera,
  Check,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Eye,
  Cpu,
  ShieldCheck,
  Sparkles,
  FileCheck2,
} from 'lucide-react'

export const DEFAULT_OCR_EXTRACTED_ROWS = [
  {
    id: 901,
    part: 'Side Panel',
    qty: 2,
    l: 750,
    w: 500,
    h: 18,
    corner: 'Edge 1x',
    material: '18mm Marine Plywood',
    cellConfidence: { part: 96.4, qty: 98.1, l: 95.8, w: 97.2, h: 99.0, material: 94.5 },
    verifiedCells: {},
  },
  {
    id: 902,
    part: 'Base Shelf',
    qty: 3,
    l: 564,
    w: 480,
    h: 18,
    corner: 'Edge 1x',
    material: '18mm Marine Plywood',
    cellConfidence: { part: 94.0, qty: 72.5, l: 92.1, w: 95.0, h: 98.4, material: 93.2 },
    note: 'Handwritten Qty "3" smudged (72.5% conf)',
    verifiedCells: {},
  },
  {
    id: 903,
    part: 'Top Panel',
    qty: 1,
    l: 600,
    w: 500,
    h: 18,
    corner: 'Edge 1x',
    material: 'MDF',
    cellConfidence: { part: 95.2, qty: 97.8, l: 74.2, w: 96.0, h: 98.1, material: 95.6 },
    note: 'Faint trailing zero on Length "600" (74.2% conf)',
    verifiedCells: {},
  },
  {
    id: 904,
    part: 'Drawer Front Face',
    qty: 4,
    l: 746,
    w: 296,
    h: 18,
    corner: 'Edge 2x',
    material: 'MDF',
    cellConfidence: { part: 89.7, qty: 95.3, l: 91.4, w: 76.8, h: 97.9, material: 92.0 },
    note: 'Handwritten Width "296" skewed across grid line (76.8% conf)',
    verifiedCells: {},
  },
  {
    id: 905,
    part: 'Stretcher Rail',
    qty: 4,
    l: 564,
    w: 100,
    h: 18,
    corner: 'None',
    material: '18mm Marine Plywood',
    cellConfidence: { part: 93.8, qty: 96.5, l: 94.9, w: 98.0, h: 99.1, material: 78.4 },
    note: 'Abbreviated "18mm Mar. Ply" expanded by token matcher (78.4% conf)',
    verifiedCells: {},
  },
]

const CONFIDENCE_THRESHOLD = 80.0

export default function OcrReviewModal({
  isOpen,
  onClose,
  onCommitParts,
  fileName = 'workshop_cutlist_scan_01.jpg',
  imagePreviewUrl = null,
  initialRows = DEFAULT_OCR_EXTRACTED_ROWS,
}) {
  const [rows, setRows] = useState(() =>
    initialRows.map((r) => ({
      ...r,
      verifiedCells: { ...(r.verifiedCells || {}) },
    }))
  )
  const [showMorphGrid, setShowMorphGrid] = useState(true)
  const [activeRowId, setActiveRowId] = useState(initialRows[1]?.id || null)

  if (!isOpen) return null

  const isCellFlagged = (row, field) => {
    const score = row.cellConfidence?.[field] ?? 95.0
    const isVerified = Boolean(row.verifiedCells?.[field])
    return score < CONFIDENCE_THRESHOLD && !isVerified
  }

  const getRowMinConfidence = (row) => {
    const scores = Object.values(row.cellConfidence || { default: 95 })
    return Math.min(...scores)
  }

  const isRowFlagged = (row) => {
    return ['part', 'qty', 'l', 'w', 'h', 'material'].some((f) => isCellFlagged(row, f))
  }

  const totalFlaggedCells = rows.reduce((acc, r) => {
    return (
      acc +
      ['part', 'qty', 'l', 'w', 'h', 'material'].filter((f) => isCellFlagged(r, f)).length
    )
  }, 0)

  const handleCellChange = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        return {
          ...r,
          [field]: value,
          verifiedCells: {
            ...(r.verifiedCells || {}),
            [field]: true,
          },
        }
      })
    )
  }

  const handleVerifyRow = (rowId) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        return {
          ...r,
          verifiedCells: {
            part: true,
            qty: true,
            l: true,
            w: true,
            h: true,
            material: true,
          },
        }
      })
    )
  }

  const handleVerifyAll = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        verifiedCells: {
          part: true,
          qty: true,
          l: true,
          w: true,
          h: true,
          material: true,
        },
      }))
    )
  }

  const handleAddRow = () => {
    const newRow = {
      id: Date.now(),
      part: 'Custom Cabinet Panel',
      qty: 1,
      l: 600,
      w: 450,
      h: 18,
      corner: 'Edge 1x',
      material: '18mm Marine Plywood',
      cellConfidence: { part: 100, qty: 100, l: 100, w: 100, h: 100, material: 100 },
      verifiedCells: { part: true, qty: true, l: true, w: true, h: true, material: true },
    }
    setRows((prev) => [...prev, newRow])
    setActiveRowId(newRow.id)
  }

  const handleDeleteRow = (rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const handleCommit = () => {
    const formatted = rows.map((r, idx) => ({
      id: Date.now() + idx,
      part: String(r.part || 'Panel').trim(),
      qty: Math.max(1, Number(r.qty) || 1),
      l: Math.max(1, Number(r.l) || 0),
      w: Math.max(1, Number(r.w) || 0),
      h: Math.max(1, Number(r.h) || 18),
      corner: r.corner || 'Edge 1x',
      material: String(r.material || '18mm Marine Plywood').trim(),
      source_jobs: ['OCR Scan'],
      ocrVerified: true,
    }))
    onCommitParts(formatted)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border-2 border-[#FACC15] shadow-2xl w-full max-w-[1440px] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================
            MODAL HEADER BAR (Industrial Pitch Black & Safety Yellow)
           ============================================================ */}
        <div className="bg-[#111827] text-white px-5 py-3.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FACC15] text-zinc-950 flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight uppercase text-white">
                  OCR Paper Cutlist Intake &amp; Human-in-the-Loop Review
                </h2>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-[#FACC15] text-zinc-950 px-2 py-0.5 rounded">
                  OpenCV + EasyOCR Vision v2.4
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Source Scan: <span className="text-zinc-200 font-semibold">{fileName}</span> ·
                Adaptive Thresholding &amp; Morphological Grid Extraction · Threshold: &ge;80% Confidence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {totalFlaggedCells > 0 ? (
              <div className="flex items-center gap-1.5 bg-yellow-400/15 border border-[#FACC15] text-[#FACC15] px-3 py-1 rounded-full text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{totalFlaggedCells} Low-Confidence Cells (&lt;80%) Flagged</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All Cells Verified by Carpenter</span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
              title="Close OCR Review Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================
            SIDE-BY-SIDE WORKSPACE:
            Left: Scanned Paper Cutlist + Morphological Grid Overlay
            Right: Interactive Editable Table with Soft-Yellow Highlights
           ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          {/* LEFT PANEL (5 Cols): Scanned Image & OpenCV Morphological Grid Preview */}
          <div className="lg:col-span-5 bg-[#18181B] p-4 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#FACC15]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    Scanned Shop-Floor Sheet Preview
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMorphGrid((v) => !v)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 border transition-colors ${
                    showMorphGrid
                      ? 'bg-[#FACC15] text-zinc-950 border-[#EAB308]'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{showMorphGrid ? 'OpenCV Grid: ON' : 'OpenCV Grid: OFF'}</span>
                </button>
              </div>

              {/* Paper Sheet Container */}
              <div className="relative rounded-xl overflow-hidden border-2 border-zinc-700 bg-[#FAF8F5] shadow-inner p-3 text-zinc-900">
                {imagePreviewUrl ? (
                  <div className="relative">
                    <img
                      src={imagePreviewUrl}
                      alt="Uploaded Paper Cutlist"
                      className="w-full max-h-[340px] object-contain rounded"
                    />
                    {showMorphGrid && (
                      <div className="absolute inset-0 pointer-events-none border-2 border-cyan-500/50 bg-grid-pattern" />
                    )}
                  </div>
                ) : (
                  /* Simulated Workshop Handwritten Cutlist Sheet with OpenCV Bounding Boxes */
                  <div className="font-mono text-[11px] select-none">
                    {/* Clipboard Header */}
                    <div className="border-b-2 border-zinc-800 pb-2 mb-2 flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-xs tracking-tight uppercase text-zinc-900">
                          ROME CABINETS — SHOP FLOOR INTAKE SHEET
                        </div>
                        <div className="text-[10px] text-zinc-600">
                          BENCH: TABLE SAW #2 · CARPENTER: M. SANTOS · UNIT: MM
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-900 text-[#FACC15] rounded">
                        SCAN #04-A
                      </span>
                    </div>

                    {/* Simulated Scanned Table with Morphological Kernel Lines */}
                    <div
                      className={`border ${
                        showMorphGrid ? 'border-cyan-600' : 'border-zinc-400'
                      } rounded overflow-hidden`}
                    >
                      <div
                        className={`grid grid-cols-12 text-[10px] font-bold uppercase px-2 py-1 ${
                          showMorphGrid
                            ? 'bg-cyan-950 text-cyan-200 border-b border-cyan-500'
                            : 'bg-zinc-200 text-zinc-800 border-b border-zinc-400'
                        }`}
                      >
                        <div className="col-span-4">PART DESCRIPTION</div>
                        <div className="col-span-1 text-center">QTY</div>
                        <div className="col-span-2 text-center">L(mm)</div>
                        <div className="col-span-2 text-center">W(mm)</div>
                        <div className="col-span-1 text-center">H</div>
                        <div className="col-span-2 text-right">MAT</div>
                      </div>

                      {rows.map((r, idx) => {
                        const rowFlagged = isRowFlagged(r)
                        const isFocused = activeRowId === r.id
                        return (
                          <div
                            key={r.id}
                            onClick={() => setActiveRowId(r.id)}
                            className={`grid grid-cols-12 items-center px-2 py-1.5 text-[11px] cursor-pointer transition-colors ${
                              showMorphGrid
                                ? 'border-b border-dashed border-cyan-500/60'
                                : 'border-b border-zinc-300'
                            } ${
                              isFocused
                                ? 'bg-yellow-200/70'
                                : rowFlagged
                                ? 'bg-yellow-100/60'
                                : 'bg-[#FAF8F5]'
                            }`}
                          >
                            <div className="col-span-4 font-semibold truncate pr-1">
                              {idx + 1}. {r.part}
                            </div>
                            <div
                              className={`col-span-1 text-center font-bold rounded px-0.5 ${
                                isCellFlagged(r, 'qty')
                                  ? 'bg-[#FACC15] text-zinc-950 ring-2 ring-amber-600'
                                  : ''
                              }`}
                            >
                              {r.qty}
                            </div>
                            <div
                              className={`col-span-2 text-center rounded mx-0.5 ${
                                isCellFlagged(r, 'l')
                                  ? 'bg-[#FACC15] text-zinc-950 font-bold ring-2 ring-amber-600'
                                  : ''
                              }`}
                            >
                              {r.l}
                            </div>
                            <div
                              className={`col-span-2 text-center rounded mx-0.5 ${
                                isCellFlagged(r, 'w')
                                  ? 'bg-[#FACC15] text-zinc-950 font-bold ring-2 ring-amber-600'
                                  : ''
                              }`}
                            >
                              {r.w}
                            </div>
                            <div className="col-span-1 text-center">{r.h}</div>
                            <div
                              className={`col-span-2 text-right truncate rounded px-0.5 text-[10px] ${
                                isCellFlagged(r, 'material')
                                  ? 'bg-[#FACC15] text-zinc-950 font-bold ring-2 ring-amber-600'
                                  : ''
                              }`}
                            >
                              {r.material}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* OpenCV Preprocessing & Telemetry Diagnostics Card */}
            <div className="mt-4 rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#FACC15]">
                <span>OpenCV Morphological Pipeline Diagnostics</span>
                <span>100% Local Vision</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800">
                  <div className="text-zinc-500">Preprocessing</div>
                  <div className="font-semibold text-zinc-200">
                    Grayscale + Adaptive Gaussian
                  </div>
                </div>
                <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800">
                  <div className="text-zinc-500">Morphological Kernels</div>
                  <div className="font-semibold text-zinc-200">
                    H-Line (40×1) · V-Line (1×40)
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Cells with OCR token confidence below{' '}
                <span className="text-[#FACC15] font-bold">80.0%</span> are automatically
                highlighted in soft yellow on the right for carpenter verification before
                committing to the active saw schedule.
              </p>
            </div>
          </div>

          {/* RIGHT PANEL (7 Cols): Interactive Editable Table */}
          <div className="lg:col-span-7 bg-white p-4 sm:p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Table Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wide">
                    Extracted Cutlist Tokens ({rows.length} Rows)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Click any cell to edit dimensions or material. Yellow cells indicate OCR
                    confidence &lt; 80%.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {totalFlaggedCells > 0 && (
                    <button
                      type="button"
                      onClick={handleVerifyAll}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-[#FACC15] hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Approve All Flagged ({totalFlaggedCells})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>

              {/* Editable OCR Verification Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-100 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-2.5 pl-3 pr-1 w-9">#</th>
                      <th className="py-2.5 px-2">Part Name</th>
                      <th className="py-2.5 px-1.5 w-16 text-center">Qty</th>
                      <th className="py-2.5 px-1.5 w-20 text-center">L (mm)</th>
                      <th className="py-2.5 px-1.5 w-20 text-center">W (mm)</th>
                      <th className="py-2.5 px-1.5 w-16 text-center">H (mm)</th>
                      <th className="py-2.5 px-2">Material</th>
                      <th className="py-2.5 px-2 text-center w-24">Conf.</th>
                      <th className="py-2.5 pl-1 pr-3 text-right w-16">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {rows.map((row, idx) => {
                      const minConf = getRowMinConfidence(row)
                      const rowFlagged = isRowFlagged(row)

                      return (
                        <tr
                          key={row.id}
                          onClick={() => setActiveRowId(row.id)}
                          className={`transition-colors ${
                            rowFlagged
                              ? 'bg-yellow-50/70 hover:bg-yellow-50'
                              : 'hover:bg-zinc-50'
                          }`}
                        >
                          <td className="py-2 pl-3 pr-1 font-bold text-zinc-600">
                            #{idx + 1}
                          </td>

                          {/* PART NAME */}
                          <td className="py-2 px-1.5">
                            <input
                              type="text"
                              value={row.part}
                              onChange={(e) =>
                                handleCellChange(row.id, 'part', e.target.value)
                              }
                              className={`w-full px-2 py-1 rounded font-semibold text-zinc-900 focus:outline-none ${
                                isCellFlagged(row, 'part')
                                  ? 'bg-yellow-100 border-2 border-[#EAB308] ring-2 ring-yellow-300/60'
                                  : 'bg-white border border-zinc-200 focus:border-[#EAB308]'
                              }`}
                            />
                          </td>

                          {/* QTY */}
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              min="1"
                              value={row.qty}
                              onChange={(e) =>
                                handleCellChange(row.id, 'qty', e.target.value)
                              }
                              title={`OCR Confidence: ${row.cellConfidence?.qty ?? 99}%`}
                              className={`w-full px-1.5 py-1 rounded text-center font-bold tabular-nums focus:outline-none ${
                                isCellFlagged(row, 'qty')
                                  ? 'bg-yellow-100 border-2 border-[#EAB308] text-zinc-950 ring-2 ring-yellow-300/70'
                                  : 'bg-white border border-zinc-200 text-zinc-900 focus:border-[#EAB308]'
                              }`}
                            />
                          </td>

                          {/* LENGTH L */}
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              value={row.l}
                              onChange={(e) =>
                                handleCellChange(row.id, 'l', e.target.value)
                              }
                              title={`OCR Confidence: ${row.cellConfidence?.l ?? 99}%`}
                              className={`w-full px-1.5 py-1 rounded text-center font-semibold tabular-nums focus:outline-none ${
                                isCellFlagged(row, 'l')
                                  ? 'bg-yellow-100 border-2 border-[#EAB308] text-zinc-950 ring-2 ring-yellow-300/70'
                                  : 'bg-white border border-zinc-200 text-zinc-800 focus:border-[#EAB308]'
                              }`}
                            />
                          </td>

                          {/* WIDTH W */}
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              value={row.w}
                              onChange={(e) =>
                                handleCellChange(row.id, 'w', e.target.value)
                              }
                              title={`OCR Confidence: ${row.cellConfidence?.w ?? 99}%`}
                              className={`w-full px-1.5 py-1 rounded text-center font-semibold tabular-nums focus:outline-none ${
                                isCellFlagged(row, 'w')
                                  ? 'bg-yellow-100 border-2 border-[#EAB308] text-zinc-950 ring-2 ring-yellow-300/70'
                                  : 'bg-white border border-zinc-200 text-zinc-800 focus:border-[#EAB308]'
                              }`}
                            />
                          </td>

                          {/* THICKNESS H */}
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              value={row.h}
                              onChange={(e) =>
                                handleCellChange(row.id, 'h', e.target.value)
                              }
                              className={`w-full px-1.5 py-1 rounded text-center font-semibold tabular-nums focus:outline-none ${
                                isCellFlagged(row, 'h')
                                  ? 'bg-yellow-100 border-2 border-[#EAB308] text-zinc-950'
                                  : 'bg-white border border-zinc-200 text-zinc-800 focus:border-[#EAB308]'
                              }`}
                            />
                          </td>

                          {/* MATERIAL */}
                          <td className="py-2 px-1.5">
                            <select
                              value={row.material}
                              onChange={(e) =>
                                handleCellChange(row.id, 'material', e.target.value)
                              }
                              title={`OCR Confidence: ${row.cellConfidence?.material ?? 99}%`}
                              className={`w-full px-2 py-1 rounded font-semibold focus:outline-none ${
                                isCellFlagged(row, 'material')
                                  ? 'bg-yellow-100 border-2 border-[#EAB308] text-zinc-950 ring-2 ring-yellow-300/70'
                                  : 'bg-white border border-zinc-200 text-zinc-800 focus:border-[#EAB308]'
                              }`}
                            >
                              <option value="18mm Marine Plywood">18mm Marine Plywood</option>
                              <option value="MDF">MDF</option>
                              <option value="Plywood">Plywood</option>
                              <option value="Oak Veneer">Oak Veneer</option>
                              <option value="Melamine Laminated Board">Melamine Board</option>
                            </select>
                          </td>

                          {/* CONFIDENCE BADGE */}
                          <td className="py-2 px-2 text-center">
                            {rowFlagged ? (
                              <button
                                type="button"
                                onClick={() => handleVerifyRow(row.id)}
                                title="Click to confirm flagged OCR reading"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] shadow-2xs"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>{minConf.toFixed(0)}%</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>{minConf < 80 ? 'Verified' : `${minConf.toFixed(0)}%`}</span>
                              </span>
                            )}
                          </td>

                          {/* ACTIONS */}
                          <td className="py-2 pl-1 pr-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {rowFlagged && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifyRow(row.id)}
                                  title="Mark row verified"
                                  className="p-1 rounded bg-zinc-900 text-[#FACC15] hover:bg-zinc-700 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                title="Remove row"
                                className="p-1 rounded text-zinc-500 hover:text-zinc-950 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Inspector Callout Banner for Flagged Cells */}
              <div className="mt-3 p-3 rounded-xl bg-yellow-50 border border-[#FACC15] flex items-start gap-2.5 text-xs text-zinc-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-zinc-950">
                    Human-in-the-Loop Quality Gate:
                  </span>{' '}
                  Cells highlighted in soft yellow scored below the{' '}
                  <span className="font-bold">80% confidence threshold</span> due to
                  handwritten smudges or grid-line overlap. Edit any value directly or click
                  the yellow confidence badge to verify accuracy before committing to the
                  saw floor.
                </div>
              </div>
            </div>

            {/* Modal Footer Action Bar */}
            <div className="pt-4 mt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-zinc-600">
                Ready to commit{' '}
                <span className="font-bold text-zinc-950">{rows.length} rows</span> (
                {rows.reduce((acc, r) => acc + (Number(r.qty) || 1), 0)} total pieces) to
                active Cutting List.
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  className="px-5 py-2.5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] text-zinc-950 font-extrabold text-xs uppercase tracking-wide flex items-center gap-2 shadow-sm transition-colors"
                >
                  <FileCheck2 className="w-4 h-4 stroke-[2.3]" />
                  <span>Confirm &amp; Commit to Workshop List</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
