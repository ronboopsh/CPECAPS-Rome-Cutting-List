import React, { useState, useRef, useEffect } from 'react'
import { Box, Minimize2 } from 'lucide-react'
import Header from './components/Header'
import SplashScreen from './components/SplashScreen'
import UploadCard from './components/UploadCard'
import CabinetWireframe from './components/CabinetWireframe'
import CuttingListTable from './components/CuttingListTable'
import ProjectSidebar from './components/ProjectSidebar'
import PartBlueprintInspector from './components/PartBlueprintInspector'
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
  exportToPDF,
} from './utils/exporter'
import {
  disambiguateCutlistPartName,
  isAmbiguousCadName,
} from './utils/panelClassifier'

// ============================================================================
// LOGO CONFIGURATION (EASY IMAGE SWAP):
// Drop your own PNG file at `/public/logo.png` (or update `LOGO_IMAGE_PATH`
// below to any image path/URL) and set `PREFER_CUSTOM_LOGO_PNG = true` to
// override the built-in pixel-accurate "ROME MODULAR SYSTEMS" SVG replica.
// ============================================================================
export const LOGO_IMAGE_PATH = '/logo.png'
export const PREFER_CUSTOM_LOGO_PNG = false

const INITIAL_SELECTED_JOBS = ['Job #1', 'Job #2']

export default function App() {
  // Interactive Carpenter Home / Splash Screen state
  const [showHomeScreen, setShowHomeScreen] = useState(true)

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
  const [isExploded, setIsExploded] = useState(false)

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
      const rawPartName = rowObj.part_name || rowObj.part || `Panel #${idx + 1}`
      const resolvedRole = disambiguateCutlistPartName(rawPartName, idx)
      return {
        id: Date.now() + idx,
        panelIndex: idx,
        num: `#${idx + 1}`,
        part: resolvedRole,
        panelRole: resolvedRole,
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

    const initialPartRole = disambiguateCutlistPartName(`${baseName} Panel`, 0)
    const defaultFallbackParts = [
      {
        id: Date.now() + 1,
        panelIndex: 0,
        num: '#1',
        part: initialPartRole,
        panelRole: initialPartRole,
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
      sourceType: 'cad',
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

  const handleModelPartsExtracted = (extractedParts, _label = '') => {
    if (!Array.isArray(extractedParts) || extractedParts.length === 0) return
    const targetJobId = activeProjectId || selectedJobs[selectedJobs.length - 1] || 'Job #1'
    const tagged = extractedParts.map((p, idx) => {
      const cleanRole =
        p.panelRole && isAmbiguousCadName(p.part)
          ? p.panelRole
          : disambiguateCutlistPartName(p.part, idx)
      return {
        ...p,
        isOrnament: Boolean(p.isOrnament),
        autoAdjusted: Boolean(p.autoAdjusted),
        adjustmentNote: p.adjustmentNote || '',
        originalDimsMm: p.originalDimsMm || null,
        totalTrimMm: p.totalTrimMm || 0,
        meshUuids: Array.isArray(p.meshUuids)
          ? p.meshUuids
          : p.meshUuid
          ? [p.meshUuid]
          : [],
        panelIndex: typeof p.panelIndex === 'number' ? p.panelIndex : idx,
        panelIndices: Array.isArray(p.panelIndices)
          ? p.panelIndices
          : [typeof p.panelIndex === 'number' ? p.panelIndex : idx],
        num: `#${idx + 1}`,
        part: cleanRole,
        panelRole: p.panelRole || cleanRole,
        source_jobs: [targetJobId],
      }
    })

    // Dynamically consolidate identical & near-identical panels and ornaments
    const { parts: consolidatedParts, stats } = aggregateProjectCutlists(tagged, {
      requireStrictCorner: true,
      matchRoleFamily: true,
    })

    setProjects((prev) => {
      const existingJob = prev[targetJobId]
      if (!existingJob) return prev
      return {
        ...prev,
        [targetJobId]: {
          ...existingJob,
          parts: consolidatedParts,
        },
      }
    })
    setParts(consolidatedParts)
    setIsConsolidated(stats.duplicateRowsEliminated > 0)
    setAggregationStats(stats)
    setSelectedId(consolidatedParts[0]?.id || null)

    const adjustedRows = consolidatedParts.filter((p) => p.autoAdjusted)
    if (adjustedRows.length > 0) {
      const adjustedPieces = adjustedRows.reduce((sum, p) => sum + (Number(p.qty) || 1), 0)
      triggerToast(
        `Auto-adjusted ${adjustedPieces} intersecting ${adjustedPieces === 1 ? 'panel' : 'panels'} to clear 3D overlaps`
      )
    }
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
    let firstAddedId = null
    setParts((prev) => {
      const startIndex = prev.length + 1
      const appended = verifiedOcrRows.map((row, idx) => ({
        ...row,
        id: Date.now() + idx,
        num: `#${startIndex + idx}`,
      }))
      firstAddedId = appended[0]?.id ?? null
      return [...prev, ...appended]
    })
    if (firstAddedId != null) {
      setSelectedId((prev) => prev ?? firstAddedId)
    }
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

  const handle3dSelectPart = (partId, partRow, rawHitData) => {
    if (partRow && partId != null) {
      setSelectedId(partId)
      triggerToast(`Selected ${partRow.num} (${partRow.part}) from 3D model`)
      return
    }

    // If the Cutting List table is currently empty, populate from the active project and select the matching row
    if (parts.length === 0) {
      const targetJobId = activeProjectId || selectedJobs[0] || 'Job #1'
      const loadedRows = getRawSelectedParts([targetJobId], projects)
      if (loadedRows.length > 0) {
        setParts(loadedRows)
        const hitUuid = rawHitData?.meshUuid || rawHitData?.key || null
        const hitRole = String(
          rawHitData?.panelRole || rawHitData?.partName || ''
        ).toLowerCase()
        const hitCat = String(rawHitData?.category || '').toLowerCase()
        const matched =
          (hitUuid &&
            loadedRows.find(
              (r) => Array.isArray(r.meshUuids) && r.meshUuids.includes(hitUuid)
            )) ||
          loadedRows.find((r) => {
            const rp = String(r.part || '').toLowerCase()
            if (rp === hitRole) return true
            if (hitRole.includes('stretcher') && rp.includes('stretcher')) return true
            if (hitRole.includes('divider') && rp.includes('divider')) return true
            if (hitRole.includes('side') && rp.includes('side') && !hitRole.includes('divider')) return true
            if (hitRole.includes('bottom') && (rp.includes('base') || rp.includes('bottom'))) return true
            if (hitRole.includes('shelf') && rp.includes('shelf') && !hitRole.includes('stretcher')) return true
            if (hitRole.includes('top') && rp.includes('top') && !hitRole.includes('stretcher') && !rp.includes('stretcher')) return true
            if (hitRole.includes('door') && (rp.includes('door') || rp.includes('front'))) return true
            if (hitCat && rp.includes(hitCat)) return true
            return false
          }) ||
          loadedRows[0]
        setSelectedId(matched.id)
        triggerToast(`Selected ${matched.num} (${matched.part}) from 3D model`)
      }
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
          Left: Input + Projects | Center: Expanded Cutting List | Right: 3D Preview + 2D Blueprint
         ============================================================ */}
      <div className="w-full max-w-[1760px] mx-auto px-4 lg:px-5 py-3 flex-1 flex flex-col">
        <main className="grid grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)_420px] xl:grid-cols-[330px_minmax(0,1fr)_450px] gap-3.5 flex-1 items-stretch">
          {/* ------------------------------------------------------------
              A. LEFT COLUMN: `<UploadCard />` (top) + `<ProjectSidebar />` (bottom)
             ------------------------------------------------------------ */}
          <section className="flex flex-col gap-3 min-w-0">
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

            <ProjectSidebar
              projects={projects}
              selectedJobs={selectedJobs}
              activeProjectId={activeProjectId}
              onToggleJob={handleToggleJob}
              onCreateProject={handleCreateProject}
              isConsolidated={isConsolidated}
              isRipSorted={isRipSorted}
              aggregationStats={aggregationStats}
              onConsolidateJobs={handleConsolidateJobs}
              onSortForRipCuts={handleSortForRipCuts}
            />
          </section>

          {/* ------------------------------------------------------------
              B. CENTER COLUMN: Expanded `<CuttingListTable />`
             ------------------------------------------------------------ */}
          <section className="flex flex-col min-w-0">
            <CuttingListTable
              parts={parts}
              totalPiecesCount={totalPiecesCount}
              activeProjectLabel={activeProject?.shortLabel || activeProject?.id}
              selectedJobsCount={selectedJobs.length}
              isConsolidated={isConsolidated}
              isRipSorted={isRipSorted}
              unit={unit}
              onSetUnit={setUnit}
              selectedId={selectedId}
              editingId={editingId}
              editDraft={editDraft}
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
            />
          </section>

          {/* ------------------------------------------------------------
              C. RIGHT COLUMN: `<CabinetWireframe />` (top) + `<PartBlueprintInspector />` (bottom)
             ------------------------------------------------------------ */}
          <section className="flex flex-col gap-3 min-w-0">
            {/* TOP CARD: Per-Project 3D WebGL Viewport (Continuously Mounted in Normal & Fullscreen Modes) */}
            <div
              className={
                isDesignExpanded
                  ? 'fixed inset-0 z-50 bg-zinc-950/65 backdrop-blur-xs flex items-center justify-center p-6'
                  : 'flex flex-col h-[356px] xl:h-[390px] shrink-0'
              }
              onClick={
                isDesignExpanded ? () => setIsDesignExpanded(false) : undefined
              }
            >
              <div
                onClick={isDesignExpanded ? (e) => e.stopPropagation() : undefined}
                className={
                  isDesignExpanded
                    ? 'bg-white dark:bg-zinc-900 rounded-2xl border-2 border-[#FACC15] shadow-2xl w-full max-w-4xl h-[82vh] max-h-[680px] p-6 flex flex-col relative transition-colors'
                    : 'bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-3.5 flex flex-col h-full relative transition-colors'
                }
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-[#111827] dark:bg-zinc-800 flex items-center justify-center border border-transparent dark:border-zinc-700 shrink-0">
                      <Box className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.2]" />
                    </div>
                    <h2 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {isDesignExpanded
                        ? `3D Preview — ${activeProject?.fullName || '3D Isometric Wireframe'}`
                        : '3D Preview'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedPartObj ? (
                      <span className="text-[10.5px] font-mono font-extrabold text-zinc-950 bg-[#FACC15] border border-[#EAB308] px-2 py-0.5 rounded-md truncate max-w-[165px]">
                        {selectedPartObj.num} {selectedPartObj.part}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 truncate max-w-[165px]">
                        {activeProject?.shortLabel || activeProject?.id}
                      </span>
                    )}
                    {isDesignExpanded && (
                      <button
                        type="button"
                        title="Exit Fullscreen 3D Viewer"
                        onClick={() => setIsDesignExpanded(false)}
                        className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
                      >
                        <Minimize2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 rounded-xl border border-gray-200 dark:border-zinc-800 bg-[#111827] relative flex items-center justify-center overflow-hidden">
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
                    isExploded={isExploded}
                    isExpanded={isDesignExpanded}
                    onToggleExplode={(nextState) => {
                      setIsExploded(nextState)
                      triggerToast(
                        nextState
                          ? 'Exploded 3D cabinet assembly (120 mm displacement)'
                          : 'Restored assembled 3D cabinet view'
                      )
                    }}
                    onFocusCamera={() => {
                      setZoom(1)
                      setFocusTrigger((c) => c + 1)
                      triggerToast(
                        selectedPartObj
                          ? `Focused 3D camera on ${selectedPartObj.num} ${selectedPartObj.part}`
                          : 'Focused 3D camera on cabinet'
                      )
                    }}
                    onResetCamera={() => {
                      setZoom(1)
                      setRotation(0)
                      setResetTrigger((c) => c + 1)
                      triggerToast('Reset 3D camera to standard isometric perspective')
                    }}
                    onExpandViewer={() => setIsDesignExpanded((prev) => !prev)}
                    onModelPartsExtracted={handleModelPartsExtracted}
                    onSelectPart={handle3dSelectPart}
                  />
                </div>
              </div>
            </div>

            {/* BOTTOM CARD: Live 2D Part Blueprint & Spec Inspector */}
            <PartBlueprintInspector
              selectedPart={selectedPartObj}
              unit={unit}
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
    </div>
  )
}
