import React, { useState, useRef, useEffect } from 'react'
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
  exportToExcelXml,
  exportToCSV,
  exportToPDF,
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
  // Interactive Carpenter Home / Splash Screen state
  const [showHomeScreen, setShowHomeScreen] = useState(false)

  // Light / Dark Mode Theme state with localStorage persistence
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('rome_cabinets_theme') || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('rome_cabinets_theme', theme)
    } catch {
      // ignore storage errors
    }
  }, [theme])

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      return next
    })
  }

  // Measurement unit ('mm', 'cm', 'm', 'in', 'ft') — default 'mm'
  const [unit, setUnit] = useState('mm')

  // Dynamic Projects map — each project holds its own `modelFile`, `modelUrl`, and `presetType`
  const [projects, setProjects] = useState(PROJECT_SCHEDULES)
  const [activeProjectId, setActiveProjectId] = useState('Job #1')

  // Multi-Project Cutlist Aggregator & Rip Sorter state
  const [selectedJobs, setSelectedJobs] = useState(INITIAL_SELECTED_JOBS)
  const [isConsolidated, setIsConsolidated] = useState(false)
  const [isRipSorted, setIsRipSorted] = useState(false)
  const [aggregationStats, setAggregationStats] = useState(null)

  // Cutting list state (trimmed down: starts empty until user selects/consolidates/adds/uploads)
  const [parts, setParts] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  // Dual Upload Card state: 'cad' | 'ocr'
  const [uploadMode, setUploadMode] = useState('cad')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const cadInputRef = useRef(null)
  const ocrInputRef = useRef(null)
  const lastUploadedRef = useRef(null)

  // OCR Human-in-the-Loop Verification Modal state
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false)
  const [ocrFileName, setOcrFileName] = useState('workshop_cutlist_scan_01.jpg')
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState(null)

  // 3D Design viewer controls
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [isDesignExpanded, setIsDesignExpanded] = useState(false)

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
    // Clicking any project pill makes that project the active 3D viewport focus
    setActiveProjectId(jobId)

    setSelectedJobs((prev) => {
      const exists = prev.includes(jobId)
      const nextJobs = exists
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
      const finalJobs = nextJobs.length > 0 ? nextJobs : [jobId]

      // Ensure activeProjectId stays synced with an active project
      if (!finalJobs.includes(jobId)) {
        setActiveProjectId(finalJobs[finalJobs.length - 1])
      } else {
        setActiveProjectId(jobId)
      }

      const rawParts = getRawSelectedParts(finalJobs, projects)
      setParts(rawParts)
      setIsConsolidated(false)
      setIsRipSorted(false)
      setAggregationStats(null)
      triggerToast(`Active 3D Project: ${jobId} · Loaded ${rawParts.length} rows`)
      return finalJobs
    })
  }

  const handleCreateProject = (customLabel, initialParts = []) => {
    const currentCount = Object.keys(projects).length
    const nextNum = currentCount + 1
    const jobId = `Job #${nextNum}`
    const cleanLabel = customLabel?.trim() || `Job ${nextNum} (Custom Cabinet)`
    const shortLabel = cleanLabel.toLowerCase().startsWith('job')
      ? cleanLabel
      : `Job ${nextNum} (${cleanLabel})`

    const taggedParts = initialParts.map((p, idx) => ({
      ...p,
      id: p.id || Date.now() + idx,
      num: `#${idx + 1}`,
      source_jobs: [jobId],
    }))

    const newProjectObj = {
      id: jobId,
      shortLabel,
      fullName: `${jobId}: ${cleanLabel}`,
      client: 'Custom Workshop Job',
      presetType: 'kitchen',
      modelFile: null,
      modelUrl: null,
      parts: taggedParts,
    }

    const updatedProjects = {
      ...projects,
      [jobId]: newProjectObj,
    }

    setProjects(updatedProjects)
    setActiveProjectId(jobId)

    const nextSelected = selectedJobs.includes(jobId)
      ? selectedJobs
      : [...selectedJobs, jobId]
    setSelectedJobs(nextSelected)

    if (taggedParts.length > 0) {
      const rawParts = getRawSelectedParts(nextSelected, updatedProjects)
      setParts(rawParts)
      setSelectedId(taggedParts[0]?.id || null)
    }

    triggerToast(`Created & selected ${shortLabel}`)
    return jobId
  }

  const handleConsolidateJobs = () => {
    const baseList =
      parts.length > 0 ? parts : getRawSelectedParts(selectedJobs, projects)
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
    const baseList =
      parts.length > 0 ? parts : getRawSelectedParts(selectedJobs, projects)
    const { parts: sortedParts, fenceSetupsCount } = sortPartsForRipCuts(baseList)
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

  // Parse uploaded CSV cutlist file into parts
  const parseCsvCutlistText = (csvText, jobId) => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    return lines.slice(1).map((line, idx) => {
      const cols = line.split(',').map((c) => c.trim())
      const rowObj = {}
      headers.forEach((h, i) => {
        rowObj[h] = cols[i] ?? ''
      })
      return {
        id: Date.now() + idx,
        num: `#${idx + 1}`,
        part: rowObj.part_name || rowObj.part || `Panel #${idx + 1}`,
        qty: Number(rowObj.quantity || rowObj.qty || rowObj.count) || 1,
        l: Number(rowObj.length || rowObj.l) || 750,
        w: Number(rowObj.width || rowObj.w) || 500,
        h: Number(rowObj.thickness || rowObj.h) || 18,
        corner: rowObj.corner_cut || rowObj.corner || 'Edge 1x',
        material: rowObj.material || '18mm Marine Plywood',
        source_jobs: [jobId],
      }
    })
  }

  // Create a dedicated project for the uploaded 3D file (.dae / .obj / .csv) with its own `modelFile` and `modelUrl`
  const registerCadUploadProject = (file) => {
    if (!file) return
    if (lastUploadedRef.current === file) return
    lastUploadedRef.current = file

    const baseName =
      file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'CAD Model'
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const is3dMesh = ['dae', 'obj'].includes(ext)

    const currentCount = Object.keys(projects).length
    const nextNum = currentCount + 1
    const jobId = `Job #${nextNum}`
    const shortLabel = `Job ${nextNum} (${baseName})`

    const objectUrl = is3dMesh ? URL.createObjectURL(file) : null

    const defaultFallbackParts = [
      {
        id: Date.now() + 1,
        num: '#1',
        part: `${baseName} Panel`,
        qty: 1,
        l: 750,
        w: 500,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        source_jobs: [jobId],
      },
    ]

    const newProjectObj = {
      id: jobId,
      shortLabel,
      fullName: `${jobId}: ${baseName}`,
      client: file.name,
      presetType: 'kitchen',
      modelFile: is3dMesh ? file : null,
      modelUrl: objectUrl,
      parts: defaultFallbackParts,
    }

    setProjects((prev) => ({
      ...prev,
      [jobId]: newProjectObj,
    }))
    // Select the newly uploaded project so the 3D viewport and table focus on it immediately
    setActiveProjectId(jobId)
    setSelectedJobs([jobId])
    setParts(defaultFallbackParts)
    setSelectedId(defaultFallbackParts[0].id)
    setIsConsolidated(false)
    setIsRipSorted(false)

    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result
        if (typeof text === 'string') {
          const csvParts = parseCsvCutlistText(text, jobId)
          if (csvParts.length > 0) {
            setProjects((prev) => ({
              ...prev,
              [jobId]: { ...prev[jobId], parts: csvParts },
            }))
            setParts(csvParts)
            setSelectedId(csvParts[0].id)
          }
        }
      }
      reader.readAsText(file)
    }

    setUploadedFile(file.name)
    triggerToast(`Created & selected ${shortLabel} from "${file.name}"`)
  }

  const handleModelPartsExtracted = (extractedParts) => {
    if (!Array.isArray(extractedParts) || extractedParts.length === 0) return
    const targetJobId = activeProjectId || selectedJobs[selectedJobs.length - 1] || 'Job #1'
    const tagged = extractedParts.map((p, idx) => ({
      ...p,
      num: `#${idx + 1}`,
      source_jobs: [targetJobId],
    }))

    setProjects((prev) => {
      const existingJob = prev[targetJobId]
      if (!existingJob) return prev
      return {
        ...prev,
        [targetJobId]: {
          ...existingJob,
          parts: tagged,
        },
      }
    })
    setParts(tagged)
    setSelectedId(tagged[0]?.id || null)
  }

  const handleModelUpload = (file) => {
    if (!file) return
    registerCadUploadProject(file)
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

    registerCadUploadProject(file)
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
    exportToExcelXml(parts, 'Rome_Cabinets_Cutting_List.xls')
    triggerToast('Exported auto-fitted Excel spreadsheet (Rome_Cabinets_Cutting_List.xls)')
  }

  const handleExportPdf = () => {
    exportToPDF()
    triggerToast('Opened browser print dialog for ISO Shop Cut Sheet (PDF)')
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
    const clickedRow = parts.find((p) => p.id === id)
    if (clickedRow?.source_jobs?.[0] && projects[clickedRow.source_jobs[0]]) {
      setActiveProjectId(clickedRow.source_jobs[0])
    }
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
      source_jobs: [activeProjectId || selectedJobs[0] || 'Job #1'],
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

  const selectedPartIndex = parts.findIndex((p) => p.id === selectedId)
  const selectedPartObj = selectedPartIndex >= 0 ? parts[selectedPartIndex] : null
  const totalPiecesCount = parts.reduce((acc, p) => acc + (Number(p.qty) || 1), 0)

  // Resolve the currently active project for per-project 3D viewport synchronization
  const activeProject =
    projects[activeProjectId] ||
    projects[selectedJobs[selectedJobs.length - 1]] ||
    projects['Job #1']

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0B0D11] text-zinc-900 dark:text-zinc-100 flex flex-col select-none transition-colors">
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
        theme={theme}
        onToggleTheme={handleToggleTheme}
        toastMessage={toastMessage}
        onNavClick={handleNavClick}
        onOpenSplash={() => setShowHomeScreen(true)}
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
              onModelUpload={handleModelUpload}
              onDrop={handleDrop}
              onTriggerSampleOcr={() =>
                triggerOcrIntake(null, 'galvez_shop_sheet_scan.jpg')
              }
            />

            {/* CARD 2: "Design" Per-Project 3D WebGL Viewport */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col flex-1 min-h-[370px] relative transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center border border-transparent dark:border-zinc-700">
                    <Box className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.2]" />
                  </div>
                  <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">
                    Design
                  </h2>
                </div>
                {selectedPartObj ? (
                  <span className="text-[11px] font-bold text-zinc-950 bg-[#FACC15] border border-[#EAB308] px-2 py-0.5 rounded-md">
                    {selectedPartObj.num} {selectedPartObj.part}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    {activeProject?.shortLabel || activeProject?.id}
                  </span>
                )}
              </div>

              <div className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-800 bg-[#111827] relative flex items-center justify-center overflow-hidden">
                <CabinetWireframe
                  unit={unit}
                  zoom={zoom}
                  rotation={rotation}
                  selectedPart={selectedPartObj}
                  selectedPartIndex={selectedPartIndex}
                  selectedPartName={selectedPartObj?.part || ''}
                  parts={parts}
                  presetType={activeProject?.presetType || 'kitchen'}
                  modelFile={activeProject?.modelFile || null}
                  modelUrl={activeProject?.modelUrl || null}
                  focusTrigger={focusTrigger}
                  resetTrigger={resetTrigger}
                  onModelPartsExtracted={handleModelPartsExtracted}
                  onSelectPart={(partId, partRow) => {
                    setSelectedId(partId)
                    if (partRow) {
                      triggerToast(`Selected ${partRow.num} (${partRow.part}) from 3D model`)
                    }
                  }}
                />

                <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    title="Focus on Selected Part Bounding Box"
                    onClick={() => {
                      setZoom(1)
                      setFocusTrigger((c) => c + 1)
                      triggerToast(
                        selectedPartObj
                          ? `Focused 3D camera on ${selectedPartObj.num} ${selectedPartObj.part}`
                          : 'Focused 3D camera on cabinet'
                      )
                    }}
                    className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] border border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-950 transition-all"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Reset Camera to Isometric View"
                    onClick={() => {
                      setZoom(1)
                      setRotation(0)
                      setResetTrigger((c) => c + 1)
                      triggerToast('Reset 3D camera to standard isometric perspective')
                    }}
                    className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] border border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-950 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Fullscreen / Expand 3D Viewer"
                    onClick={() => setIsDesignExpanded(true)}
                    className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] border border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-950 transition-all"
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
              onSetUnit={setUnit}
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
                projects={projects}
                selectedJobs={selectedJobs}
                onToggleJob={handleToggleJob}
                onCreateProject={handleCreateProject}
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
            className="bg-white dark:bg-zinc-900 rounded-2xl border-2 border-[#FACC15] shadow-xl w-full max-w-3xl h-[540px] p-6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center">
                  <Box className="w-4 h-4 text-[#FACC15]" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Design — {activeProject?.fullName || '3D Isometric Wireframe'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDesignExpanded(false)}
                className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-800 bg-[#111827] overflow-hidden">
              <CabinetWireframe
                unit={unit}
                zoom={zoom}
                rotation={rotation}
                selectedPart={selectedPartObj}
                selectedPartIndex={selectedPartIndex}
                selectedPartName={selectedPartObj?.part || ''}
                parts={parts}
                presetType={activeProject?.presetType || 'kitchen'}
                modelFile={activeProject?.modelFile || null}
                modelUrl={activeProject?.modelUrl || null}
                focusTrigger={focusTrigger}
                resetTrigger={resetTrigger}
                onModelPartsExtracted={handleModelPartsExtracted}
                onSelectPart={(partId, partRow) => {
                  setSelectedId(partId)
                  if (partRow) {
                    triggerToast(`Selected ${partRow.num} (${partRow.part}) from 3D model`)
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
