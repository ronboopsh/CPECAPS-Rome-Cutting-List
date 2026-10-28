import React, { useState, useRef } from 'react'
import {
  Box,
  Search,
  RefreshCw,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import Header from './components/Header'
import SplashScreen from './components/SplashScreen'
import UploadCard from './components/UploadCard'
import CabinetWireframe from './components/CabinetWireframe'
import CuttingListTable from './components/CuttingListTable'
import ProjectTray from './components/ProjectTray'
import InventoryPanel from './components/InventoryPanel'
import OcrReviewModal, { DEFAULT_OCR_EXTRACTED_ROWS } from './components/OcrReviewModal'
import {
  PROJECT_SCHEDULES,
  getRawSelectedParts,
  aggregateProjectCutlists,
  sortPartsForRipCuts,
} from './utils/aggregator'
import {
  formatDimensionByUnit,
  exportCuttingListToCsv,
  exportCuttingListToPrintablePdf,
} from './utils/exporter'

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

  // Dual Upload Card state: 'cad' | 'ocr'
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

  const formatDim = (mmValue) => formatDimensionByUnit(mmValue, unit)

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

  // Export handlers (`src/utils/exporter.js`)
  const handleExportCsv = () => {
    exportCuttingListToCsv(parts, unit)
    triggerToast('Exported cutting list to Excel / CSV')
  }

  const handleExportPdf = () => {
    const ok = exportCuttingListToPrintablePdf(parts, unit, selectedJobs)
    if (ok) {
      triggerToast('Generated ISO Printable Shop Cut Sheet (PDF)')
    } else {
      triggerToast('Allow popups to print ISO PDF cut sheet')
    }
  }

  // Handle Top Navigation Bar clicks
  const handleNavClick = (label) => {
    if (label === 'Home') {
      setShowHomeScreen(true)
    } else if (label === 'Data') {
      handleExportCsv()
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

  const handleAddPart = () => {
    const nextNum =
      parts.length > 0
        ? Math.max(...parts.map((p) => parseInt(p.num.replace('#', ''), 10) || 0)) + 1
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
  }

  // Add new stock sheet
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
  const totalPiecesCount = parts.reduce((acc, p) => acc + (Number(p.qty) || 1), 0)

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-zinc-900 flex flex-col select-none">
      {/* ============================================================
          INTERACTIVE CARPENTER SPLASH / HOME SCREEN (`SplashScreen.jsx`)
         ============================================================ */}
      {showHomeScreen && (
        <SplashScreen
          onEnterWorkshop={() => setShowHomeScreen(false)}
          logoPath={LOGO_IMAGE_PATH}
          preferCustomLogo={PREFER_CUSTOM_LOGO_PNG}
          partsCount={parts.length}
        />
      )}

      {/* ============================================================
          TWO-TIER INDUSTRIAL TOP BAR (`Header.jsx`)
         ============================================================ */}
      <Header
        unit={unit}
        onSetUnit={setUnit}
        loggedIn={loggedIn}
        onToggleLogin={() => {
          setLoggedIn((v) => !v)
          triggerToast(
            !loggedIn
              ? 'Authenticated: Rome Cabinets Portal'
              : 'Switched to Workshop Guest Session'
          )
        }}
        toastMessage={toastMessage}
        onNavClick={handleNavClick}
        onOpenSplash={() => setShowHomeScreen(true)}
        partsCount={parts.length}
        totalPiecesCount={totalPiecesCount}
        inventoryCount={inventory.length}
        onTriggerToast={triggerToast}
        logoPath={LOGO_IMAGE_PATH}
        preferCustomLogo={PREFER_CUSTOM_LOGO_PNG}
      />

      {/* ============================================================
          THREE-COLUMN MAIN DASHBOARD
          Left: ~25% | Center: ~50% | Right: ~25%
         ============================================================ */}
      <div className="w-full max-w-[1680px] mx-auto px-4 lg:px-6 py-4 flex-1 flex flex-col">
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
          {/* ------------------------------------------------------------
              A. LEFT COLUMN (`UploadCard.jsx` + `CabinetWireframe.jsx`)
             ------------------------------------------------------------ */}
          <section className="lg:col-span-3 flex flex-col gap-4">
            <UploadCard
              uploadMode={uploadMode}
              onSetUploadMode={setUploadMode}
              isDragging={isDragging}
              onSetIsDragging={setIsDragging}
              uploadedFile={uploadedFile}
              cadInputRef={cadInputRef}
              ocrInputRef={ocrInputRef}
              onFileReceive={handleFileReceive}
              onDrop={handleDrop}
              onTriggerSampleOcr={() =>
                triggerOcrIntake(null, 'galvez_shop_sheet_scan.jpg')
              }
            />

            {/* CARD 2: "Design" 3D Isometric Technical Wireframe */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col flex-1 min-h-[370px] relative">
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

              <div className="flex-1 rounded-xl border border-gray-200 bg-[#FAFAFA] relative flex items-center justify-center overflow-hidden">
                <CabinetWireframe
                  unit={unit}
                  zoom={zoom}
                  rotation={rotation}
                  selectedPart={selectedPartObj}
                />

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
              B. CENTER COLUMN (`CuttingListTable.jsx` + `ProjectTray.jsx`)
             ------------------------------------------------------------ */}
          <section className="lg:col-span-6 flex flex-col">
            <CuttingListTable
              parts={parts}
              totalPiecesCount={totalPiecesCount}
              unit={unit}
              selectedId={selectedId}
              editingId={editingId}
              editDraft={editDraft}
              isRipSorted={isRipSorted}
              formatDim={formatDim}
              onRowClick={handleRowClick}
              onStartEditing={startEditing}
              onChangeEditDraft={setEditDraft}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onDeleteRow={deleteRow}
              onAddPart={handleAddPart}
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
            >
              <ProjectTray
                selectedJobs={selectedJobs}
                onToggleJob={handleToggleJob}
                isConsolidated={isConsolidated}
                isRipSorted={isRipSorted}
                aggregationStats={aggregationStats}
                onConsolidateJobs={handleConsolidateJobs}
                onSortForRipCuts={handleSortForRipCuts}
              />
            </CuttingListTable>
          </section>

          {/* ------------------------------------------------------------
              C. RIGHT COLUMN (`InventoryPanel.jsx`)
             ------------------------------------------------------------ */}
          <section className="lg:col-span-3 flex flex-col">
            <InventoryPanel
              inventory={inventory}
              unit={unit}
              formatDim={formatDim}
              newSheet={newSheet}
              onSetNewSheet={setNewSheet}
              onAddMaterial={handleAddMaterial}
            />
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
