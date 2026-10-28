import React, { useState, useRef } from 'react'
import {
  Upload,
  Box,
  Search,
  RefreshCw,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  ClipboardList,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  UserCheck,
  Camera,
  GitMerge,
  ArrowDownWideNarrow,
  CheckSquare,
  Square,
  Sparkles,
  FileCode2,
} from 'lucide-react'
import CabinetWireframe from './components/CabinetWireframe'
import RomeLogo from './components/RomeLogo'
import CarpenterSplash from './components/CarpenterSplash'
import OcrReviewModal, { DEFAULT_OCR_EXTRACTED_ROWS } from './components/OcrReviewModal'
import {
  PROJECT_SCHEDULES,
  getRawSelectedParts,
  aggregateProjectCutlists,
  sortPartsForRipCuts,
} from './utils/aggregator'

// ============================================================================
// LOGO CONFIGURATION (EASY IMAGE SWAP):
// Drop your own PNG file at `/public/logo.png` (or update `LOGO_IMAGE_PATH`
// below to any image path/URL) and set `PREFER_CUSTOM_LOGO_PNG = true` to
// override the built-in pixel-accurate "ROME MODULAR SYSTEMS" SVG replica.
// ============================================================================
export const LOGO_IMAGE_PATH = '/logo.png'
export const PREFER_CUSTOM_LOGO_PNG = false

const INITIAL_SELECTED_JOBS = ['Job #1', 'Job #2']

const INITIAL_CUTTING_LIST = [
  { id: 1, num: '#1', part: 'Side Panel', qty: 2, l: 750, w: 500, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
  { id: 2, num: '#2', part: 'Shelf', qty: 2, l: 564, w: 480, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
  { id: 3, num: '#3', part: 'Shelf', qty: 1, l: 564, w: 480, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
  { id: 4, num: '#4', part: 'Side Panel', qty: 2, l: 750, w: 500, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
  { id: 5, num: '#5', part: 'Wardrobe Tall Gable', qty: 2, l: 2100, w: 600, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
  { id: 7, num: '#6', part: 'Top Panel', qty: 1, l: 600, w: 500, h: 18, corner: 'Edge 1x', material: 'MDF', source_jobs: ['Job #1'] },
  { id: 8, num: '#7', part: 'Fixed Shelf', qty: 3, l: 564, w: 480, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
  { id: 9, num: '#8', part: 'Top Stretcher', qty: 2, l: 564, w: 100, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
  { id: 10, num: '#9', part: 'Cabinet Door Slab', qty: 2, l: 746, w: 296, h: 18, corner: 'Edge 2x', material: 'MDF', source_jobs: ['Job #1'] },
  { id: 11, num: '#10', part: 'Top Panel', qty: 2, l: 600, w: 500, h: 18, corner: 'Edge 1x', material: 'MDF', source_jobs: ['Job #2'] },
  { id: 12, num: '#11', part: 'Valance Rail', qty: 2, l: 864, w: 100, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
]

const INITIAL_INVENTORY = [
  {
    id: 1,
    num: '1',
    l: 2440,
    w: 1220,
    h: 18,
    material: '18mm Marine Plywood',
    usedPercent: 82,
    barColor: 'bg-[#FACC15]', // Bright Industrial Yellow fill
    iconType: 'clipboard',
  },
  {
    id: 2,
    num: '2',
    l: 2440,
    w: 1220,
    h: 18,
    material: 'Plywood',
    usedPercent: 78,
    barColor: 'bg-[#F59E0B]', // Industrial Amber fill
    iconType: 'layers',
  },
  {
    id: 3,
    num: '3',
    l: 2440,
    w: 1220,
    h: 18,
    material: 'MDF',
    usedPercent: 76,
    barColor: 'bg-[#CA8A04]', // Deep Gold fill
    iconType: 'sheet',
  },
]

const TOP_NAV_ITEMS = [
  { label: 'Home', hasDropdown: false },
  { label: 'Browse', hasDropdown: true },
  { label: 'Tools', hasDropdown: true },
  { label: 'Data', hasDropdown: true },
  { label: 'More', hasDropdown: true },
  { label: 'Help', hasDropdown: false },
]

export default function App() {
  // Interactive Carpenter Home / Splash Screen state (default: true on initial load)
  const [showHomeScreen, setShowHomeScreen] = useState(true)

  // Unit toggle: 'metric' (mm) or 'imperial' (in)
  const [unit, setUnit] = useState('metric')

  // Multi-Project Cutlist Aggregator & Rip Sorter state
  const [selectedJobs, setSelectedJobs] = useState(INITIAL_SELECTED_JOBS)
  const [isConsolidated, setIsConsolidated] = useState(false)
  const [isRipSorted, setIsRipSorted] = useState(false)
  const [aggregationStats, setAggregationStats] = useState(null)

  // Cutting list state (#3 active by default per specification)
  const [parts, setParts] = useState(INITIAL_CUTTING_LIST)
  const [selectedId, setSelectedId] = useState(3)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  // Dual Upload Card state: 'cad' ("Upload 3D CAD (.dae, .obj, .csv)") | 'ocr' ("Scan Paper Cutlist (.png, .jpg)")
  const [uploadMode, setUploadMode] = useState('cad')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const cadInputRef = useRef(null)
  const ocrInputRef = useRef(null)

  // OCR Human-in-the-Loop Verification Modal state
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false)
  const [ocrFileName, setOcrFileName] = useState('workshop_cutlist_scan_01.jpg')
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState(null)

  // 3D Design viewer controls
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDesignExpanded, setIsDesignExpanded] = useState(false)

  // Workshop Account state
  const [loggedIn, setLoggedIn] = useState(false)

  // Inventory stock state & new row (#4) draft inputs
  const [inventory, setInventory] = useState(INITIAL_INVENTORY)
  const [newSheet, setNewSheet] = useState({
    l: '2440',
    w: '1220',
    h: '18',
    material: '18mm Marine Plywood',
  })

  // Status toast for top menu actions
  const [toastMessage, setToastMessage] = useState(null)

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3000)
  }

  // Format dimension value according to Metric (mm) or Imperial (in)
  const formatDim = (mmValue) => {
    if (unit === 'metric') return mmValue
    const inches = Number(mmValue) / 25.4
    return inches >= 10 ? inches.toFixed(1) : inches.toFixed(2)
  }

  // ==========================================================================
  // MODULE 1 HANDLERS: MULTI-PROJECT SELECTOR, CONSOLIDATE & RIP SORTER
  // ==========================================================================
  const handleToggleJob = (jobId) => {
    setSelectedJobs((prev) => {
      const exists = prev.includes(jobId)
      const nextJobs = exists
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
      const finalJobs = nextJobs.length > 0 ? nextJobs : [jobId]
      const rawParts = getRawSelectedParts(finalJobs, PROJECT_SCHEDULES)
      setParts(rawParts)
      setIsConsolidated(false)
      setIsRipSorted(false)
      setAggregationStats(null)
      triggerToast(`Loaded schedules: ${finalJobs.join(', ')} (${rawParts.length} rows)`)
      return finalJobs
    })
  }

  const handleConsolidateJobs = () => {
    const baseList =
      parts.length > 0 ? parts : getRawSelectedParts(selectedJobs, PROJECT_SCHEDULES)
    const { parts: mergedParts, stats } = aggregateProjectCutlists(baseList)
    setParts(mergedParts)
    setIsConsolidated(true)
    setAggregationStats((prev) => ({
      ...(prev || {}),
      ...stats,
    }))
    triggerToast(
      `Consolidated ${stats.totalRawRows} rows into ${stats.totalConsolidatedRows} unique parts (${stats.totalPieces} pcs)`
    )
  }

  const handleSortForRipCuts = () => {
    const { parts: sortedParts, fenceSetupsCount } = sortPartsForRipCuts(parts)
    setParts(sortedParts)
    setIsRipSorted(true)
    setAggregationStats((prev) => ({
      ...(prev || {}),
      fenceSetupsCount,
    }))
    triggerToast(
      `Sorted for Table Saw Rip Cuts (W ↓ then L ↓) — ${fenceSetupsCount} fence setups`
    )
  }

  // ==========================================================================
  // MODULE 2 HANDLERS: DUAL UPLOAD & OCR REVIEW MODAL
  // ==========================================================================
  const triggerOcrIntake = (fileObj = null, customLabel = null) => {
    if (fileObj) {
      setOcrFileName(fileObj.name)
      setUploadedFile(fileObj.name)
      if (fileObj.type && fileObj.type.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(fileObj)
        setOcrPreviewUrl(objectUrl)
      } else {
        setOcrPreviewUrl(null)
      }
    } else {
      const name = customLabel || 'galvez_kitchen_handwritten_cutlist.jpg'
      setOcrFileName(name)
      setUploadedFile(name)
      setOcrPreviewUrl(null)
    }
    setIsOcrModalOpen(true)
    triggerToast('OCR Vision Pipeline complete — 4 cells (<80% conf) flagged for review')
  }

  const handleFileReceive = (file) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const isImage =
      ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext) ||
      (file.type && file.type.startsWith('image/'))

    if (uploadMode === 'ocr' || isImage) {
      setUploadMode('ocr')
      triggerOcrIntake(file)
      return
    }

    setUploadedFile(file.name)
    triggerToast(`Parsed 3D CAD file "${file.name}" into shop-floor coordinator`)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileReceive(e.dataTransfer.files[0])
    }
  }

  const handleCommitOcrParts = (verifiedOcrRows) => {
    setParts((prev) => {
      const startIndex = prev.length + 1
      const appended = verifiedOcrRows.map((row, idx) => ({
        ...row,
        id: Date.now() + idx,
        num: `#${startIndex + idx}`,
      }))
      return [...prev, ...appended]
    })
    setIsOcrModalOpen(false)
    triggerToast(
      `Committed ${verifiedOcrRows.length} verified OCR parts to active Cutting List`
    )
  }

  // Export CSV helper
  const exportCsv = () => {
    const headers = [
      '#',
      'Part',
      'Qty',
      `L (${unit === 'metric' ? 'mm' : 'in'})`,
      `W (${unit === 'metric' ? 'mm' : 'in'})`,
      `H (${unit === 'metric' ? 'mm' : 'in'})`,
      'Corner',
      'Material',
      'Source Jobs',
    ]
    const csvRows = [
      headers.join(','),
      ...parts.map((p) =>
        [
          p.num,
          `"${p.part}"`,
          p.qty || 1,
          formatDim(p.l),
          formatDim(p.w),
          formatDim(p.h),
          `"${p.corner}"`,
          `"${p.material}"`,
          `"${(p.source_jobs || ['Job #1']).join(' + ')}"`,
        ].join(',')
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rome-cabinets-cutting-list.csv'
    a.click()
    URL.revokeObjectURL(url)
    triggerToast('Exported cutting list to CSV')
  }

  // Handle Top Navigation Bar clicks
  const handleNavClick = (label) => {
    if (label === 'Home') {
      setShowHomeScreen(true)
    } else if (label === 'Data') {
      exportCsv()
    } else if (label === 'Browse') {
      if (uploadMode === 'ocr') {
        ocrInputRef.current?.click()
      } else {
        cadInputRef.current?.click()
      }
    } else if (label === 'Tools') {
      setZoom((z) => (z === 1 ? 1.15 : 1))
      triggerToast('Toggled 3D cabinet wireframe inspection zoom')
    } else {
      triggerToast(`${label} module active`)
    }
  }

  // Cutting list row actions
  const handleRowClick = (id) => {
    if (editingId === id) return
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const startEditing = (e, item) => {
    e.stopPropagation()
    setEditingId(item.id)
    setEditDraft({ ...item, qty: item.qty || 1 })
  }

  const saveEdit = (e) => {
    e.stopPropagation()
    if (!editDraft) return
    setParts((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...editDraft,
              qty: Math.max(1, Number(editDraft.qty) || 1),
              l: Number(editDraft.l) || 0,
              w: Number(editDraft.w) || 0,
              h: Number(editDraft.h) || 0,
            }
          : item
      )
    )
    setEditingId(null)
    setEditDraft(null)
    triggerToast(`Updated ${editDraft.num} (${editDraft.part})`)
  }

  const cancelEdit = (e) => {
    e.stopPropagation()
    setEditingId(null)
    setEditDraft(null)
  }

  const deleteRow = (e, item) => {
    e.stopPropagation()
    setParts((prev) => prev.filter((p) => p.id !== item.id))
    if (selectedId === item.id) setSelectedId(null)
    triggerToast(`Removed ${item.num} ${item.part}`)
  }

  // Add new stock sheet from Row #4
  const handleAddMaterial = () => {
    const lVal = Number(newSheet.l) || 2440
    const wVal = Number(newSheet.w) || 1220
    const hVal = Number(newSheet.h) || 18
    const matVal = newSheet.material.trim() || 'MDF'
    const nextNum = inventory.length + 1
    const colors = ['bg-[#FACC15]', 'bg-[#F59E0B]', 'bg-[#CA8A04]']
    const icons = ['clipboard', 'layers', 'sheet']

    const created = {
      id: Date.now(),
      num: String(nextNum),
      l: lVal,
      w: wVal,
      h: hVal,
      material: matVal,
      usedPercent: 78,
      barColor: colors[(nextNum - 1) % colors.length],
      iconType: icons[(nextNum - 1) % icons.length],
    }

    setInventory((prev) => [...prev, created])
    setNewSheet({ l: '2440', w: '1220', h: '18', material: '18mm Marine Plywood' })
    triggerToast(`Added Sheet #${nextNum} (${lVal} × ${wVal} × ${hVal} mm ${matVal})`)
  }

  const selectedPartObj = parts.find((p) => p.id === selectedId) || null
  const nextInventoryIndex = inventory.length + 1
  const totalPiecesCount = parts.reduce((acc, p) => acc + (Number(p.qty) || 1), 0)

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-zinc-900 flex flex-col select-none">
      {/* ============================================================
          INTERACTIVE CARPENTER SPLASH / HOME SCREEN (INITIAL LOAD)
         ============================================================ */}
      {showHomeScreen && (
        <CarpenterSplash
          onEnterWorkshop={() => setShowHomeScreen(false)}
          logoPath={LOGO_IMAGE_PATH}
          preferCustomLogo={PREFER_CUSTOM_LOGO_PNG}
          partsCount={parts.length}
        />
      )}

      {/* ============================================================
          TWO-TIER INDUSTRIAL TOP BAR
         ============================================================ */}
      <header className="w-full shadow-xs">
        {/* TIER 1: Utility & Navigation Bar (Solid Pitch Black / Dark Charcoal) */}
        <div className="bg-[#18181B] text-zinc-100 border-b border-zinc-800">
          <div className="max-w-[1680px] mx-auto px-4 lg:px-6 h-11 flex items-center justify-between text-[13px]">
            {/* Left Side: Horizontal Navigation Menu */}
            <nav className="flex items-center gap-1 sm:gap-2">
              {TOP_NAV_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNavClick(item.label)}
                  className="px-2.5 py-1 rounded text-zinc-200 hover:text-[#FACC15] hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-1.5"
                >
                  {item.label === 'Home' && (
                    <RomeLogo variant="badge" className="w-4 h-4" />
                  )}
                  <span>{item.label}</span>
                  {item.hasDropdown && (
                    <span className="text-[11px] text-zinc-400 group-hover:text-[#FACC15]">
                      ▾
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Right Side: Workshop Account + Black & Yellow Unit Pill Switch */}
            <div className="flex items-center gap-4">
              {toastMessage && (
                <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-zinc-950 bg-[#FACC15] px-3 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />
                  <span>{toastMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setLoggedIn((v) => !v)
                  triggerToast(
                    !loggedIn
                      ? 'Authenticated: Rome Cabinets Portal'
                      : 'Switched to Workshop Guest Session'
                  )
                }}
                className="text-xs sm:text-[13px] font-medium text-zinc-300 hover:text-[#FACC15] transition-colors flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#FACC15]" />
                <span>
                  {loggedIn ? 'Rome Cabinets Portal' : 'Login to Workshop Account'}
                </span>
              </button>

              <span className="text-zinc-700 hidden sm:inline">|</span>

              {/* Integrated Imperial / Metric Pill Switch in Black & Yellow */}
              <div className="flex items-center bg-zinc-950 p-0.5 rounded-full border border-zinc-700">
                <button
                  type="button"
                  onClick={() => setUnit('imperial')}
                  className={`px-3 py-0.5 rounded-full text-xs transition-all ${
                    unit === 'imperial'
                      ? 'bg-[#FACC15] text-zinc-950 font-bold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-100 font-medium'
                  }`}
                >
                  Imperial
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('metric')}
                  className={`px-3 py-0.5 rounded-full text-xs transition-all ${
                    unit === 'metric'
                      ? 'bg-[#FACC15] text-zinc-950 font-bold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-100 font-medium'
                  }`}
                >
                  Metric
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TIER 2: Main Header Banner (Branding & Status Strip with <RomeLogo />) */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-[1680px] mx-auto px-4 lg:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* Left Side: Official Rome Modular Systems Logo + Prominent "Rome Cabinets" Typography */}
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                title="Open Carpenter Splash Screen"
                onClick={() => setShowHomeScreen(true)}
                className="rounded-lg overflow-hidden shadow-xs hover:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
              >
                <RomeLogo
                  logoPath={LOGO_IMAGE_PATH}
                  preferImage={PREFER_CUSTOM_LOGO_PNG}
                  variant="full"
                  className="h-12 w-auto"
                />
              </button>
              <div className="flex items-baseline gap-2.5">
                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 uppercase">
                  Rome{' '}
                  <span className="bg-[#FACC15] px-2 py-0.5 rounded text-zinc-950">
                    Cabinets
                  </span>
                </h1>
                <span className="hidden md:inline-block text-[11px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-300 rounded px-1.5 py-0.5">
                  CNC · CAD · OCR v2.5
                </span>
              </div>
            </div>

            {/* Right Side: Two-Line Metadata and Status Block */}
            <div className="sm:text-right">
              <p className="text-[13.5px] font-bold text-zinc-900 tracking-tight">
                Automated Cutting List &amp; Shop-Floor Coordinator
              </p>
              <div className="text-xs text-zinc-500 font-medium mt-0.5 flex flex-wrap sm:justify-end items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-zinc-800 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#EAB308] inline-block" />
                  Active Session
                </span>
                <span className="text-zinc-300">|</span>
                <span className="font-semibold text-zinc-700">
                  {parts.length} Rows ({totalPiecesCount} Pcs)
                </span>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() =>
                    triggerToast(
                      `Shop Efficiency: 82% Yield across ${inventory.length} Stock Sheets`
                    )
                  }
                  className="hover:text-zinc-950 hover:underline decoration-[#FACC15] decoration-2 underline-offset-2 transition-colors"
                >
                  Shop Statistics
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() =>
                    triggerToast('Click any cutting list row to inspect 3D cut plane')
                  }
                  className="hover:text-zinc-950 hover:underline decoration-[#FACC15] decoration-2 underline-offset-2 transition-colors"
                >
                  Help
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================
          THREE-COLUMN MAIN DASHBOARD
          Left: ~25% | Center: ~50% | Right: ~25%
         ============================================================ */}
      <div className="w-full max-w-[1680px] mx-auto px-4 lg:px-6 py-4 flex-1 flex flex-col">
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
          {/* ------------------------------------------------------------
              A. LEFT COLUMN (Dual CAD / OCR Upload Card + 3D Wireframe)
             ------------------------------------------------------------ */}
          <section className="lg:col-span-3 flex flex-col gap-4">
            {/* CARD 1: Dual-Mode Upload Zone (3D CAD vs. Paper Cutlist OCR) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              {/* Dual Upload Tabs */}
              <div className="grid grid-cols-2 gap-1.5 bg-zinc-900 p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setUploadMode('cad')}
                  className={`py-2 px-2 rounded-lg text-[11px] font-extrabold leading-tight flex flex-col items-center justify-center gap-1 transition-all ${
                    uploadMode === 'cad'
                      ? 'bg-[#FACC15] text-zinc-950 shadow-xs'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Upload 3D CAD (.dae, .obj, .csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMode('ocr')}
                  className={`py-2 px-2 rounded-lg text-[11px] font-extrabold leading-tight flex flex-col items-center justify-center gap-1 transition-all ${
                    uploadMode === 'ocr'
                      ? 'bg-[#FACC15] text-zinc-950 shadow-xs'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Paper Cutlist (.png, .jpg)</span>
                </button>
              </div>

              {/* Hidden file inputs for CAD and OCR Camera/Image */}
              <input
                ref={cadInputRef}
                type="file"
                accept=".dae,.obj,.csv,.skp,.json"
                className="hidden"
                onChange={(e) => handleFileReceive(e.target.files?.[0])}
              />
              <input
                ref={ocrInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileReceive(e.target.files?.[0])}
              />

              {/* Dropzone Area */}
              <div
                onClick={() =>
                  uploadMode === 'ocr'
                    ? ocrInputRef.current?.click()
                    : cadInputRef.current?.click()
                }
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`group cursor-pointer rounded-xl border-2 border-dashed transition-all px-4 py-5 flex flex-col items-center justify-center text-center ${
                  isDragging
                    ? 'border-[#EAB308] bg-yellow-50/70'
                    : 'border-zinc-300 hover:border-[#FACC15] hover:bg-yellow-50/30'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-zinc-900 group-hover:bg-[#FACC15] border border-zinc-800 group-hover:border-[#EAB308] flex items-center justify-center mb-2.5 text-[#FACC15] group-hover:text-zinc-950 transition-colors shadow-xs">
                  {uploadMode === 'ocr' ? (
                    <Camera className="w-5 h-5 stroke-[2.2]" />
                  ) : (
                    <Upload className="w-5 h-5 stroke-[2.2]" />
                  )}
                </div>
                <p className="text-[12.5px] font-extrabold tracking-wide text-zinc-900 uppercase">
                  {uploadMode === 'ocr'
                    ? 'DROP PAPER CUTLIST PHOTO HERE'
                    : 'DROP 3D CAD FILES HERE'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {uploadedFile
                    ? `Loaded: ${uploadedFile}`
                    : uploadMode === 'ocr'
                    ? 'Drag & drop .png / .jpg or tap to capture via camera'
                    : 'Supports .dae, .obj, .csv, and SketchUp .skp'}
                </p>
              </div>

              {/* Quick OCR Demo Trigger Button for Immediate Inspection */}
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => triggerOcrIntake(null, 'galvez_shop_sheet_scan.jpg')}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[#FACC15] text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open OCR Vision Review Modal (Sample Scan)</span>
                </button>
              </div>
            </div>

            {/* CARD 2: "Design" 3D Isometric Technical Wireframe */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col flex-1 min-h-[370px] relative">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center">
                    <Box className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.2]" />
                  </div>
                  <h2 className="text-[15px] font-bold text-zinc-900">Design</h2>
                </div>
                {selectedPartObj && (
                  <span className="text-[11px] font-bold text-zinc-950 bg-[#FACC15] border border-[#EAB308] px-2 py-0.5 rounded-md">
                    {selectedPartObj.num} {selectedPartObj.part}
                  </span>
                )}
              </div>

              {/* Technical Line-Drawing Preview Area */}
              <div className="flex-1 rounded-xl border border-gray-200 bg-[#FAFAFA] relative flex items-center justify-center overflow-hidden">
                <CabinetWireframe
                  unit={unit}
                  zoom={zoom}
                  rotation={rotation}
                  selectedPart={selectedPartObj}
                />

                {/* Bottom Toolbar Overlay with Circular Action Buttons */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    title="Zoom / Magnify"
                    onClick={() =>
                      setZoom((z) => (z >= 1.3 ? 1 : Number((z + 0.15).toFixed(2))))
                    }
                    className="w-8 h-8 rounded-full bg-white hover:bg-[#FACC15] border border-zinc-300 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 hover:text-zinc-950 transition-all"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Rotate / Sync Wireframe"
                    onClick={() => setRotation((r) => (r === 0 ? -4 : r === -4 ? 4 : 0))}
                    className="w-8 h-8 rounded-full bg-white hover:bg-[#FACC15] border border-zinc-300 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 hover:text-zinc-950 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Fullscreen / Expand"
                    onClick={() => setIsDesignExpanded(true)}
                    className="w-8 h-8 rounded-full bg-white hover:bg-[#FACC15] border border-zinc-300 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 hover:text-zinc-950 transition-all"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------
              B. CENTER COLUMN (Cutting List + Multi-Project Aggregator & Rip Sorter)
             ------------------------------------------------------------ */}
          <section className="lg:col-span-6 flex flex-col">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col flex-1">
              {/* Top Header Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[16px] font-bold text-zinc-900">Cutting List</h2>
                  <span className="text-xs font-medium text-zinc-500">
                    ({parts.length} rows · {totalPiecesCount} pcs ·{' '}
                    {unit === 'metric' ? 'mm' : 'in'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextNum =
                      parts.length > 0
                        ? Math.max(
                            ...parts.map((p) => parseInt(p.num.replace('#', ''), 10) || 0)
                          ) + 1
                        : 1
                    const newPart = {
                      id: Date.now(),
                      num: `#${nextNum}`,
                      part: 'Side Panel',
                      qty: 1,
                      l: 750,
                      w: 500,
                      h: 18,
                      corner: 'Edge 1x',
                      material: '18mm Marine Plywood',
                      source_jobs: [selectedJobs[0] || 'Job #1'],
                    }
                    setParts((prev) => [...prev, newPart])
                    setSelectedId(newPart.id)
                    triggerToast(`Added ${newPart.num} (${newPart.part})`)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-950 bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Add Part</span>
                </button>
              </div>

              {/* ============================================================
                  MODULE 1 BAR: MULTI-PROJECT SELECTOR PILLS & ACTION BUTTONS
                 ============================================================ */}
              <div className="mb-3 p-3 rounded-xl bg-zinc-900 text-zinc-100 border border-zinc-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Multi-project selector toggle pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mr-1">
                      Schedules:
                    </span>
                    {Object.values(PROJECT_SCHEDULES).map((job) => {
                      const active = selectedJobs.includes(job.id)
                      return (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => handleToggleJob(job.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                            active
                              ? 'bg-[#FACC15] text-zinc-950 border-[#EAB308] shadow-2xs'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          {active ? (
                            <CheckSquare className="w-3.5 h-3.5 stroke-[2.4]" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                          <span>{job.shortLabel}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Action Buttons: "Consolidate Jobs" and "Sort for Rip Cuts (W ↓)" */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleConsolidateJobs}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                        isConsolidated
                          ? 'bg-[#FACC15] text-zinc-950 ring-2 ring-yellow-300'
                          : 'bg-zinc-800 hover:bg-[#FACC15] text-[#FACC15] hover:text-zinc-950 border border-[#FACC15]/50'
                      }`}
                    >
                      <GitMerge className="w-3.5 h-3.5 stroke-[2.3]" />
                      <span>Consolidate Jobs</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSortForRipCuts}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                        isRipSorted
                          ? 'bg-[#FACC15] text-zinc-950 ring-2 ring-yellow-300'
                          : 'bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950'
                      }`}
                    >
                      <ArrowDownWideNarrow className="w-3.5 h-3.5 stroke-[2.3]" />
                      <span>Sort for Rip Cuts (W ↓)</span>
                    </button>
                  </div>
                </div>

                {/* Live Consolidation & Saw-Setup Status Strip */}
                {(isConsolidated || isRipSorted) && (
                  <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap items-center gap-2">
                      {isConsolidated && (
                        <span className="inline-flex items-center gap-1 bg-zinc-800 text-[#FACC15] px-2 py-0.5 rounded font-bold">
                          Merged {aggregationStats?.duplicateRowsEliminated ?? 0} Identical
                          Part Schedules
                        </span>
                      )}
                      {isRipSorted && (
                        <span className="inline-flex items-center gap-1 bg-zinc-800 text-emerald-300 px-2 py-0.5 rounded font-bold">
                          Rip Sequence Active: Grouped by Material &amp; H → Width (W ↓) →
                          Length (L ↓) ({aggregationStats?.fenceSetupsCount ?? 5} Fence
                          Setups)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Master Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      <th className="py-2.5 pl-2.5 pr-1.5 w-11">#</th>
                      <th className="py-2.5 px-2">PART &amp; SOURCE JOBS</th>
                      <th className="py-2.5 px-1.5 w-14 text-center">QTY</th>
                      <th className="py-2.5 px-1.5 w-14">L</th>
                      <th className="py-2.5 px-1.5 w-14">W ↓</th>
                      <th className="py-2.5 px-1.5 w-12">H</th>
                      <th className="py-2.5 px-2">CORNER</th>
                      <th className="py-2.5 px-2">MATERIAL</th>
                      <th className="py-2.5 pl-1 pr-2.5 text-right w-18">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[13px]">
                    {parts.map((row) => {
                      const isSelected = row.id === selectedId
                      const isEditing = row.id === editingId
                      const qtyVal = Number(row.qty) || 1
                      const sourceJobs =
                        Array.isArray(row.source_jobs) && row.source_jobs.length > 0
                          ? row.source_jobs
                          : ['Job #1']
                      const isMultiJob = row.consolidated || sourceJobs.length > 1

                      return (
                        <tr
                          key={row.id}
                          onClick={() => handleRowClick(row.id)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-yellow-50/90 hover:bg-yellow-100/80 border-l-4 border-l-[#FACC15]'
                              : 'hover:bg-zinc-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          {/* # Badge */}
                          <td className="py-2 pl-2.5 pr-1.5 font-medium">
                            <span
                              className={`inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? 'text-zinc-950 bg-[#FACC15]'
                                  : 'text-zinc-500'
                              }`}
                            >
                              {row.num}
                            </span>
                          </td>

                          {/* PART + CONSOLIDATED SOURCE JOB BADGES */}
                          <td className="py-2 px-2 font-semibold text-zinc-900">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDraft.part}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, part: e.target.value })
                                }
                                className="w-28 px-2 py-0.5 text-xs bg-white border-2 border-[#EAB308] rounded focus:outline-none"
                              />
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span>{row.part}</span>
                                {isMultiJob && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#FACC15] text-zinc-950 border border-[#EAB308]">
                                    MERGED ×{qtyVal}
                                  </span>
                                )}
                                {sourceJobs.map((jobTag) => (
                                  <span
                                    key={jobTag}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      jobTag === 'OCR Scan'
                                        ? 'bg-zinc-900 text-[#FACC15]'
                                        : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                                    }`}
                                  >
                                    {jobTag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* QTY */}
                          <td className="py-2 px-1.5 text-center tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                value={editDraft.qty}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, qty: e.target.value })
                                }
                                className="w-12 px-1 py-0.5 text-xs text-center bg-white border-2 border-[#EAB308] rounded focus:outline-none"
                              />
                            ) : (
                              <span
                                className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-extrabold ${
                                  isMultiJob
                                    ? 'bg-zinc-900 text-[#FACC15]'
                                    : 'bg-zinc-100 text-zinc-800'
                                }`}
                              >
                                ×{qtyVal}
                              </span>
                            )}
                          </td>

                          {/* L */}
                          <td className="py-2 px-1.5 text-zinc-700 tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editDraft.l}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, l: e.target.value })
                                }
                                className="w-14 px-1.5 py-0.5 text-xs bg-white border-2 border-[#EAB308] rounded focus:outline-none"
                              />
                            ) : (
                              formatDim(row.l)
                            )}
                          </td>

                          {/* W */}
                          <td className="py-2 px-1.5 text-zinc-900 font-bold tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editDraft.w}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, w: e.target.value })
                                }
                                className="w-14 px-1.5 py-0.5 text-xs bg-white border-2 border-[#EAB308] rounded focus:outline-none"
                              />
                            ) : (
                              <span
                                className={
                                  isRipSorted
                                    ? 'bg-yellow-100/90 text-zinc-950 px-1.5 py-0.5 rounded border border-[#EAB308]'
                                    : ''
                                }
                              >
                                {formatDim(row.w)}
                              </span>
                            )}
                          </td>

                          {/* H */}
                          <td className="py-2 px-1.5 text-zinc-700 tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editDraft.h}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, h: e.target.value })
                                }
                                className="w-12 px-1.5 py-0.5 text-xs bg-white border-2 border-[#EAB308] rounded focus:outline-none"
                              />
                            ) : (
                              formatDim(row.h)
                            )}
                          </td>

                          {/* CORNER */}
                          <td className="py-2 px-2 text-zinc-600">
                            {isEditing ? (
                              <select
                                value={editDraft.corner}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, corner: e.target.value })
                                }
                                className="px-1.5 py-0.5 text-xs bg-white border-2 border-[#EAB308] rounded focus:outline-none"
                              >
                                <option value="None">None</option>
                                <option value="Edge 1x">Edge 1x</option>
                                <option value="Edge 2x">Edge 2x</option>
                              </select>
                            ) : (
                              <span
                                className={
                                  row.corner === 'None'
                                    ? 'text-zinc-500'
                                    : 'text-zinc-800 font-medium'
                                }
                              >
                                {row.corner}
                              </span>
                            )}
                          </td>

                          {/* MATERIAL */}
                          <td className="py-2 px-2 text-zinc-800 font-medium">
                            {isEditing ? (
                              <select
                                value={editDraft.material}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, material: e.target.value })
                                }
                                className="px-1.5 py-0.5 text-xs bg-white border-2 border-[#EAB308] rounded focus:outline-none"
                              >
                                <option value="18mm Marine Plywood">
                                  18mm Marine Plywood
                                </option>
                                <option value="MDF">MDF</option>
                                <option value="Plywood">Plywood</option>
                                <option value="Oak Veneer">Oak Veneer</option>
                              </select>
                            ) : (
                              row.material
                            )}
                          </td>

                          {/* ACTIONS (Dark charcoal icons with yellow hover effects) */}
                          <td className="py-2 pl-1 pr-2.5 text-right">
                            {isEditing ? (
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  title="Save changes"
                                  onClick={saveEdit}
                                  className="p-1 rounded-md bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  title="Cancel"
                                  onClick={cancelEdit}
                                  className="p-1 rounded-md text-zinc-600 hover:bg-zinc-200 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-end gap-1.5 text-zinc-700">
                                <button
                                  type="button"
                                  title="Edit row"
                                  onClick={(e) => startEditing(e, row)}
                                  className="p-1 rounded-md text-zinc-700 hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Delete row"
                                  onClick={(e) => deleteRow(e, row)}
                                  className="p-1 rounded-md text-zinc-700 hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------
              C. RIGHT COLUMN (Inventory Stock & Scrap Tracker)
             ------------------------------------------------------------ */}
          <section className="lg:col-span-3 flex flex-col">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col justify-between flex-1">
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-[16px] font-bold text-zinc-900">Inventory</h2>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                    Stock &amp; Scrap
                  </span>
                </div>

                {/* Compact Column Header: # | L | W | H | MAT */}
                <div className="grid grid-cols-12 items-center text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b-2 border-zinc-200 pb-2 px-1">
                  <div className="col-span-2">#</div>
                  <div className="col-span-3">L</div>
                  <div className="col-span-3">W</div>
                  <div className="col-span-2">H</div>
                  <div className="col-span-2 text-right">MAT</div>
                </div>

                {/* Stock Sheets List */}
                <div className="divide-y divide-gray-100">
                  {inventory.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="py-3 px-1 hover:bg-yellow-50/40 rounded-xl transition-colors"
                    >
                      {/* Sheet Dimensions Row */}
                      <div className="grid grid-cols-12 items-center text-[12.5px] font-medium text-zinc-800">
                        <div className="col-span-2 flex items-center gap-1.5 text-zinc-700">
                          {sheet.iconType === 'clipboard' && (
                            <ClipboardList className="w-3.5 h-3.5 text-zinc-800 shrink-0" />
                          )}
                          {sheet.iconType === 'layers' && (
                            <Layers className="w-3.5 h-3.5 text-zinc-800 shrink-0" />
                          )}
                          {sheet.iconType === 'sheet' && (
                            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-800 shrink-0" />
                          )}
                          <span className="font-bold text-zinc-900">#{sheet.num}</span>
                        </div>
                        <div className="col-span-3 tabular-nums text-zinc-900 font-semibold">
                          {formatDim(sheet.l)}{' '}
                          <span className="text-zinc-400 font-normal">×</span>
                        </div>
                        <div className="col-span-3 tabular-nums text-zinc-900 font-semibold">
                          {formatDim(sheet.w)}{' '}
                          <span className="text-zinc-400 font-normal">×</span>
                        </div>
                        <div className="col-span-2 tabular-nums text-zinc-800">
                          {formatDim(sheet.h)}
                          <span className="text-[11px] text-zinc-500 ml-0.5">
                            {unit === 'metric' ? 'mm' : '"'}
                          </span>
                        </div>
                        <div className="col-span-2 text-right font-bold text-zinc-900 truncate">
                          {sheet.material}
                        </div>
                      </div>

                      {/* Usage Progress Bar Underneath: Yellow/Amber/Gold over Dark Charcoal Track */}
                      <div className="mt-2 flex items-center gap-2.5 pl-5">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${sheet.barColor} transition-all duration-300`}
                            style={{ width: `${sheet.usedPercent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-zinc-700 shrink-0 tabular-nums">
                          {sheet.usedPercent}% used
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Row #4: Input fields to enter a new sheet length, width, and material */}
                  <div className="py-3 px-1">
                    <div className="grid grid-cols-12 items-center gap-1.5 text-[12.5px]">
                      <div className="col-span-2 font-bold text-zinc-600 pl-1">
                        #{nextInventoryIndex}
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          aria-label="New sheet length"
                          value={newSheet.l}
                          onChange={(e) =>
                            setNewSheet({ ...newSheet, l: e.target.value })
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleAddMaterial()}
                          placeholder="2440"
                          className="w-full px-2 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors tabular-nums"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          aria-label="New sheet width"
                          value={newSheet.w}
                          onChange={(e) =>
                            setNewSheet({ ...newSheet, w: e.target.value })
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleAddMaterial()}
                          placeholder="1220"
                          className="w-full px-2 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors tabular-nums"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          aria-label="New sheet thickness"
                          value={newSheet.h}
                          onChange={(e) =>
                            setNewSheet({ ...newSheet, h: e.target.value })
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleAddMaterial()}
                          placeholder="18"
                          className="w-full px-1.5 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors tabular-nums"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          aria-label="New sheet material"
                          value={newSheet.material}
                          onChange={(e) =>
                            setNewSheet({ ...newSheet, material: e.target.value })
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleAddMaterial()}
                          placeholder="MDF"
                          className="w-full px-1.5 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors text-right"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Full-Width Action Button: "+ Add Material" (Industrial Yellow & Crisp Black Text) */}
              <div className="pt-3 mt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleAddMaterial}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] text-zinc-950 font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ Add Material</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* ============================================================
          MODULE 2: HUMAN-IN-THE-LOOP OCR VERIFICATION MODAL
         ============================================================ */}
      <OcrReviewModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onCommitParts={handleCommitOcrParts}
        fileName={ocrFileName}
        imagePreviewUrl={ocrPreviewUrl}
        initialRows={DEFAULT_OCR_EXTRACTED_ROWS}
      />

      {/* Fullscreen 3D Technical Wireframe Modal when Expand is clicked */}
      {isDesignExpanded && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-6"
          onClick={() => setIsDesignExpanded(false)}
        >
          <div
            className="bg-white rounded-2xl border-2 border-[#FACC15] shadow-xl w-full max-w-3xl h-[540px] p-6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center">
                  <Box className="w-4 h-4 text-[#FACC15]" />
                </div>
                <h3 className="text-base font-bold text-zinc-900">
                  Design — Technical Isometric Wireframe (Base Cabinet 750 × 500 × 500 mm)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDesignExpanded(false)}
                className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 rounded-xl border border-gray-200 bg-[#FAFAFA] overflow-hidden">
              <CabinetWireframe
                unit={unit}
                zoom={zoom}
                rotation={rotation}
                selectedPart={selectedPartObj}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
