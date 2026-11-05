import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { Layers, Search, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'
import { formatDimensionByUnit, normalizeUnitCode } from '../utils/exporter'
import {
  classifyCabinetPanels,
  normalizeLoadedCabinetModel,
  isAmbiguousCadName,
} from '../utils/panelClassifier'

/**
 * Interactive 3D WebGL Cabinet Viewer (`src/components/CabinetWireframe.jsx`)
 * Supports:
 *  - Compound 3D Mesh Decomposition (`minDim > 25 mm`) into discrete flat boards
 *  - Redundant Top Face Merging (cubby top face flush beneath cabinet Top Panel)
 *  - Automated Panel Role Classification via 3D Bounding Box geometry analysis
 *  - Interactive Exploded View vector engine (0 mm to 120 mm orthogonal displacement)
 *  - Persistent DOM mounting across normal & fullscreen modes (`meshListRef.current`)
 */

const EXPLODE_MAX_DISTANCE_MM = 120
const EXPLODE_TRANSITION_MS = 400

// 1. Job #1 Preset: Base Kitchen Cabinet (750mm W x 500mm H x 500mm D)
const KITCHEN_CABINET_PANELS = [
  { key: 'k-left-side', partName: 'Left Side Panel', category: 'side', dims: [18, 500, 500], pos: [-366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'k-right-side', partName: 'Right Side Panel', category: 'side', dims: [18, 500, 500], pos: [366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'k-top-panel', partName: 'Top Panel', category: 'top', dims: [750, 18, 500], pos: [0, 241, 0], displayDims: '600 × 500 × 18 mm' },
  { key: 'k-bottom-deck', partName: 'Bottom Panel', category: 'bottom', dims: [714, 18, 480], pos: [0, -181, 0], displayDims: '564 × 480 × 18 mm' },
  { key: 'k-mid-shelf', partName: 'Shelf #1', category: 'shelf', dims: [714, 18, 460], pos: [0, 25, -10], displayDims: '564 × 460 × 18 mm' },
  { key: 'k-top-stretcher-f', partName: 'Top Stretcher', category: 'stretcher', dims: [714, 18, 100], pos: [0, 214, 190], displayDims: '564 × 100 × 18 mm' },
  { key: 'k-top-stretcher-b', partName: 'Top Stretcher', category: 'stretcher', dims: [714, 18, 100], pos: [0, 214, -190], displayDims: '564 × 100 × 18 mm' },
  { key: 'k-door-left', partName: 'Front Face / Door', category: 'door', dims: [354, 410, 18], pos: [-180, 24, 252], displayDims: '746 × 296 × 18 mm' },
  { key: 'k-door-right', partName: 'Front Face / Door', category: 'door', dims: [354, 410, 18], pos: [180, 24, 252], displayDims: '746 × 296 × 18 mm' },
]

// 2. Job #2 Preset: Tall Wardrobe Carcass (900mm W x 2100mm H x 600mm D)
const WARDROBE_CABINET_PANELS = [
  { key: 'w-left-gable', partName: 'Left Side Panel', category: 'side', dims: [18, 2100, 600], pos: [-441, 0, 0], displayDims: '2100 × 600 × 18 mm' },
  { key: 'w-right-gable', partName: 'Right Side Panel', category: 'side', dims: [18, 2100, 600], pos: [441, 0, 0], displayDims: '2100 × 600 × 18 mm' },
  { key: 'w-center-divider', partName: 'Center Gable / Divider', category: 'divider', dims: [18, 1512, 560], pos: [0, -185, -10], displayDims: '1512 × 560 × 18 mm' },
  { key: 'w-top-cap', partName: 'Top Panel', category: 'top', dims: [900, 18, 600], pos: [0, 1041, 0], displayDims: '900 × 600 × 18 mm' },
  { key: 'w-bottom-deck', partName: 'Bottom Panel', category: 'bottom', dims: [864, 18, 580], pos: [0, -950, 0], displayDims: '864 × 580 × 18 mm' },
  { key: 'w-upper-shelf', partName: 'Upper Fixed Shelf', category: 'shelf', dims: [864, 18, 560], pos: [0, 580, -10], displayDims: '864 × 560 × 18 mm' },
  { key: 'w-mid-shelf-1', partName: 'Right-Bay Cubby Shelf', category: 'shelf', dims: [423, 18, 560], pos: [215, 120, -10], displayDims: '423 × 560 × 18 mm' },
  { key: 'w-mid-shelf-2', partName: 'Right-Bay Cubby Shelf', category: 'shelf', dims: [423, 18, 560], pos: [215, -350, -10], displayDims: '423 × 560 × 18 mm' },
  { key: 'w-valance-rail', partName: 'Valance Rail', category: 'rail', dims: [864, 100, 18], pos: [0, -1000, 282], displayDims: '864 × 100 × 18 mm' },
]

// 3. Job #3 Preset: 3-Tier Workshop Drawer Bank Carcass (750mm W x 750mm H x 500mm D)
const DRAWER_BANK_PANELS = [
  { key: 'd-left-side', partName: 'Left Side Panel', category: 'side', dims: [18, 750, 500], pos: [-366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'd-right-side', partName: 'Right Side Panel', category: 'side', dims: [18, 750, 500], pos: [366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'd-top-stretcher-f', partName: 'Top Stretcher', category: 'stretcher', dims: [714, 18, 100], pos: [0, 366, 195], displayDims: '564 × 100 × 18 mm' },
  { key: 'd-top-stretcher-b', partName: 'Top Stretcher', category: 'stretcher', dims: [714, 18, 100], pos: [0, 366, -195], displayDims: '564 × 100 × 18 mm' },
  { key: 'd-bottom-stretcher', partName: 'Bottom Panel', category: 'bottom', dims: [714, 18, 480], pos: [0, -330, 0], displayDims: '564 × 480 × 18 mm' },
  { key: 'd-front-top', partName: 'Front Face / Door', category: 'door', dims: [738, 210, 18], pos: [0, 235, 255], displayDims: '746 × 296 × 18 mm' },
  { key: 'd-box-top-l', partName: 'Drawer Box Side', category: 'drawer_side', dims: [18, 160, 450], pos: [-330, 235, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-box-top-r', partName: 'Drawer Box Side', category: 'drawer_side', dims: [18, 160, 450], pos: [330, 235, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-front-mid', partName: 'Front Face / Door', category: 'door', dims: [738, 210, 18], pos: [0, 10, 255], displayDims: '746 × 296 × 18 mm' },
  { key: 'd-box-mid-l', partName: 'Drawer Box Side', category: 'drawer_side', dims: [18, 160, 450], pos: [-330, 10, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-box-mid-r', partName: 'Drawer Box Side', category: 'drawer_side', dims: [18, 160, 450], pos: [330, 10, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-front-bot', partName: 'Front Face / Door', category: 'door', dims: [738, 210, 18], pos: [0, -215, 255], displayDims: '746 × 296 × 18 mm' },
  { key: 'd-box-bot-l', partName: 'Drawer Box Side', category: 'drawer_side', dims: [18, 160, 450], pos: [-330, -215, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-box-bot-r', partName: 'Drawer Box Side', category: 'drawer_side', dims: [18, 160, 450], pos: [330, -215, 15], displayDims: '450 × 160 × 18 mm' },
]

const PRESET_CONFIGS = {
  kitchen: {
    panels: KITCHEN_CABINET_PANELS,
    label: 'Job #1: Base Kitchen Cabinet (750 × 500 × 500 mm)',
    bounds: { w: 750, d: 500, h: 500 },
  },
  wardrobe: {
    panels: WARDROBE_CABINET_PANELS,
    label: 'Job #2: Tall Wardrobe Carcass (900 × 600 × 2100 mm)',
    bounds: { w: 900, d: 600, h: 2100 },
  },
  drawer_bank: {
    panels: DRAWER_BANK_PANELS,
    label: 'Job #3: 3-Tier Drawer Bank (750 × 500 × 750 mm)',
    bounds: { w: 750, d: 500, h: 750 },
  },
}

/**
 * Matches a 3D mesh's metadata with the active row in the Cutting List table.
 */
function doesMeshMatchSelectedPart(meshUserData, selectedPart, selectedPartName, selectedPartIndex, meshUuid = null) {
  if (!selectedPart && !selectedPartName && (selectedPartIndex == null || selectedPartIndex < 0)) {
    return false
  }

  const effectiveUuid = meshUserData.meshUuid || meshUserData.key || meshUuid || null

  // 1. Multi-Mesh Selection Sync via `selectedPart.meshUuids` (highlights all consolidated meshes simultaneously)
  if (
    effectiveUuid &&
    Array.isArray(selectedPart?.meshUuids) &&
    selectedPart.meshUuids.length > 0
  ) {
    return (
      selectedPart.meshUuids.includes(effectiveUuid) ||
      (meshUuid && selectedPart.meshUuids.includes(meshUuid))
    )
  }
  if (effectiveUuid && selectedPart?.meshUuid) {
    return (
      selectedPart.meshUuid === effectiveUuid ||
      (meshUuid && selectedPart.meshUuid === meshUuid)
    )
  }

  // 2. Multi-Panel Index Sync via `selectedPart.panelIndices`
  if (
    typeof meshUserData.panelIndex === 'number' &&
    Array.isArray(selectedPart?.panelIndices) &&
    selectedPart.panelIndices.length > 0
  ) {
    return selectedPart.panelIndices.includes(meshUserData.panelIndex)
  }

  // 3. Direct unique part ID match (for single-mesh extracted 3D CAD parts or hardware groups)
  if (selectedPart?.id != null && meshUserData.partId != null) {
    if (meshUserData.partId === selectedPart.id) return true
    if (
      (String(selectedPart.id).startsWith('cad-') ||
        String(selectedPart.id).startsWith('hw-')) &&
      !selectedPart?.consolidated
    ) {
      return false
    }
  }

  // 3b. Hardware / Footing match
  if (meshUserData.isHardware || meshUserData.type === 'hardware') {
    if (selectedPart?.type === 'hardware' || selectedPart?.isHardware) {
      return true
    }
    return false
  }
  if (selectedPart?.type === 'hardware' || selectedPart?.isHardware) {
    return false
  }

  // 4. Direct unique panelIndex match when present on an unconsolidated row
  if (
    !selectedPart?.consolidated &&
    typeof selectedPart?.panelIndex === 'number' &&
    typeof meshUserData.panelIndex === 'number'
  ) {
    return meshUserData.panelIndex === selectedPart.panelIndex
  }

  const targetName = String(
    selectedPart?.panelRole ||
      selectedPart?.part ||
      selectedPart?.part_name ||
      selectedPartName ||
      ''
  )
    .toLowerCase()
    .trim()

  if (!targetName) {
    if (
      typeof selectedPartIndex === 'number' &&
      selectedPartIndex >= 0 &&
      meshUserData.partIndex === selectedPartIndex
    ) {
      return true
    }
    return false
  }

  const meshRole = String(meshUserData.panelRole || '')
    .toLowerCase()
    .trim()
  const meshName = String(meshUserData.partName || meshUserData.name || '')
    .toLowerCase()
    .trim()
  const category = String(meshUserData.category || '').toLowerCase()

  // Strict Stretcher / Rail Isolation: never match a stretcher/rail with a Top Panel or Shelf
  const isMeshStretcherOrRail =
    category === 'stretcher' ||
    category === 'rail' ||
    meshRole.includes('stretcher') ||
    meshRole.includes('rail') ||
    meshRole.includes('valance') ||
    meshName.includes('stretcher') ||
    meshName.includes('rail') ||
    meshName.includes('valance')

  const isTargetStretcherOrRail =
    targetName.includes('stretcher') ||
    targetName.includes('rail') ||
    targetName.includes('valance')

  if (isMeshStretcherOrRail !== isTargetStretcherOrRail) {
    return false
  }

  // Strict Divider vs. Side Gable Isolation: never match a central divider with outer Side Gables
  const isMeshDivider =
    category === 'divider' ||
    meshRole.includes('divider') ||
    meshName.includes('divider')
  const isTargetDivider =
    targetName.includes('divider') || targetName.includes('partition')

  if (isMeshDivider !== isTargetDivider) {
    return false
  }

  // 3. Exact match on classified panelRole or partName (e.g., "Left Side Panel", "Divider L", "Shelf #1")
  if (meshRole && targetName === meshRole) return true
  if (meshName && targetName === meshName) return true

  // 4. Disambiguated directional/indexed role checks
  if (targetName === 'divider l') return meshRole === 'divider l'
  if (targetName === 'divider r') return meshRole === 'divider r'
  if (targetName.includes('left side')) return meshRole === 'left side panel'
  if (targetName.includes('right side')) return meshRole === 'right side panel'
  if (isTargetDivider) return isMeshDivider
  if (targetName.includes('bottom panel')) return meshRole === 'bottom panel' || category === 'bottom'
  if (targetName.includes('back panel')) return meshRole === 'back panel'
  if (targetName.includes('front face')) return meshRole === 'front face / door' || category === 'door'

  const shelfMatch = targetName.match(/^shelf\s*#(\d+)$/)
  if (shelfMatch) {
    return meshRole === `shelf #${shelfMatch[1]}`
  }

  // 5. Consolidated / Preset category matches
  if (isTargetStretcherOrRail) {
    return isMeshStretcherOrRail
  }
  if (targetName.includes('top')) {
    return meshRole === 'top panel' || category === 'top'
  }
  if (targetName.includes('base shelf')) {
    return meshRole === 'bottom panel' || category === 'bottom'
  }
  if (targetName.includes('drawer') && targetName.includes('side')) {
    return category === 'drawer_side' || meshName.includes('drawer box side')
  }
  if (targetName.includes('side') || targetName.includes('gable')) {
    return (category === 'side' || meshRole.includes('side')) && !isMeshDivider
  }
  if (targetName.includes('shelf') || targetName.includes('shelves')) {
    return (category === 'shelf' || meshRole.startsWith('shelf')) && !isMeshStretcherOrRail
  }
  if (targetName.includes('door') || targetName.includes('front') || targetName.includes('slab')) {
    return category === 'door' || meshRole === 'front face / door'
  }

  if (
    typeof selectedPartIndex === 'number' &&
    selectedPartIndex >= 0 &&
    meshUserData.partIndex === selectedPartIndex
  ) {
    return true
  }

  return false
}

export default function CabinetWireframe({
  unit = 'mm',
  zoom = 1,
  rotation = 0,
  selectedPart = null,
  selectedPartIndex = null,
  selectedPartName = '',
  parts = [],
  hardwareItems = [],
  presetType = 'kitchen',
  modelFile = null,
  modelUrl = null,
  onSelectPart = null,
  onModelPartsExtracted = null,
  focusTrigger = 0,
  resetTrigger = 0,
  isExploded: externalIsExploded = undefined,
  onToggleExplode: externalOnToggleExplode = null,
  onFocusCamera = null,
  onResetCamera = null,
  onExpandViewer = null,
  isExpanded = false,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const gridHelperRef = useRef(null)
  const cabinetGroupRef = useRef(null)

  // Persistent ref array of active panel meshes indexed by cutting list order
  const meshListRef = useRef([])
  const isCustomModelRef = useRef(false)
  const defaultCameraPosRef = useRef(new THREE.Vector3(920, 680, 960))
  const defaultTargetRef = useRef(new THREE.Vector3(0, 0, 0))

  // Interactive Exploded View state (0.0 = assembled, 1.0 = 120mm exploded)
  const [internalExploded, setInternalExploded] = useState(false)
  const isExploded =
    typeof externalIsExploded === 'boolean' ? externalIsExploded : internalExploded
  const [explodeProgress, setExplodeProgress] = useState(0)
  const explodeProgressRef = useRef(0)
  const explodeAnimFrameRef = useRef(null)

  const [hoveredPanel, setHoveredPanel] = useState(null)
  const [modelStatus, setModelStatus] = useState(PRESET_CONFIGS.kitchen.label)
  const [modelBoundsSummary, setModelBoundsSummary] = useState(PRESET_CONFIGS.kitchen.bounds)

  const partsRef = useRef(parts)
  partsRef.current = parts
  const hardwareItemsRef = useRef(hardwareItems)
  hardwareItemsRef.current = hardwareItems
  const selectedPartRef = useRef(selectedPart)
  selectedPartRef.current = selectedPart
  const selectedPartIndexRef = useRef(selectedPartIndex)
  selectedPartIndexRef.current = selectedPartIndex
  const selectedPartNameRef = useRef(selectedPartName)
  selectedPartNameRef.current = selectedPartName
  const onSelectPartRef = useRef(onSelectPart)
  onSelectPartRef.current = onSelectPart
  const onModelPartsExtractedRef = useRef(onModelPartsExtracted)
  onModelPartsExtractedRef.current = onModelPartsExtracted

  const fmt = (mm) => {
    const code = normalizeUnitCode(unit)
    return `${formatDimensionByUnit(mm, code)} ${code}`
  }

  // Interpolate mesh positions along their orthogonal outward explosion vectors
  const updateExplodedPositions = (progressVal, explodeDistance = EXPLODE_MAX_DISTANCE_MM) => {
    const meshes = meshListRef.current
    if (!meshes || meshes.length === 0) return

    meshes.forEach((mesh) => {
      if (mesh.userData?.basePosition && mesh.userData?.explodeDir) {
        mesh.position
          .copy(mesh.userData.basePosition)
          .addScaledVector(mesh.userData.explodeDir, explodeDistance * progressVal)
      }
    })
    cabinetGroupRef.current?.updateMatrixWorld(true)
  }

  // Animate `explodeProgress` smoothly over 400ms using `requestAnimationFrame` lerp
  const animateExplodeTo = (targetProgress) => {
    const clampedTarget = Math.min(1, Math.max(0, targetProgress))
    const startProgress = explodeProgressRef.current
    const startTime = performance.now()

    if (explodeAnimFrameRef.current) {
      cancelAnimationFrame(explodeAnimFrameRef.current)
      explodeAnimFrameRef.current = null
    }

    if (Math.abs(clampedTarget - startProgress) < 0.001) {
      explodeProgressRef.current = clampedTarget
      setExplodeProgress(clampedTarget)
      updateExplodedPositions(clampedTarget)
      return
    }

    const stepTransition = (now) => {
      const elapsed = now - startTime
      const t = Math.min(1, Math.max(0, elapsed / EXPLODE_TRANSITION_MS))
      // Cubic ease-in-out lerp
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const currentProgress = startProgress + (clampedTarget - startProgress) * eased

      explodeProgressRef.current = currentProgress
      setExplodeProgress(currentProgress)
      updateExplodedPositions(currentProgress)

      if (t < 1) {
        explodeAnimFrameRef.current = requestAnimationFrame(stepTransition)
      } else {
        explodeProgressRef.current = clampedTarget
        setExplodeProgress(clampedTarget)
        updateExplodedPositions(clampedTarget)
        explodeAnimFrameRef.current = null
      }
    }

    explodeAnimFrameRef.current = requestAnimationFrame(stepTransition)
  }

  // Sync external `isExploded` prop if controlled from parent
  useEffect(() => {
    if (typeof externalIsExploded === 'boolean') {
      animateExplodeTo(externalIsExploded ? 1.0 : 0.0)
    }
  }, [externalIsExploded])

  const handleToggleExplode = () => {
    const nextState = !isExploded
    setInternalExploded(nextState)
    animateExplodeTo(nextState ? 1.0 : 0.0)
    if (typeof externalOnToggleExplode === 'function') {
      externalOnToggleExplode(nextState)
    }
  }

  // Dispose all children inside a Three.js Group
  const clearGroup = (group) => {
    if (!group) return
    while (group.children.length > 0) {
      const child = group.children[0]
      group.remove(child)
      child.traverse?.((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
    }
    meshListRef.current = []
  }

  // Highlight mesh by Cutting List row index or active part metadata
  const highlightMeshByIndex = (targetIndex = selectedPartIndexRef.current) => {
    const meshes = meshListRef.current
    if (!meshes || meshes.length === 0) return

    const activePart = selectedPartRef.current
    const activeName = selectedPartNameRef.current
    const isUploadedModel = isCustomModelRef.current

    const matchFlags = meshes.map((mesh, idx) => {
      if (
        doesMeshMatchSelectedPart(
          mesh.userData,
          activePart,
          activeName,
          targetIndex,
          mesh.uuid
        )
      ) {
        return true
      }
      if (
        !activePart &&
        !activeName &&
        typeof targetIndex === 'number' &&
        targetIndex >= 0 &&
        idx === targetIndex
      ) {
        return true
      }
      return false
    })

    // Enforce strict Highlight-to-Quantity parity (`highlightedCount <= activePart.qty`)
    const maxExpectedHighlights =
      activePart && !activePart.isHardware && activePart.type !== 'hardware'
        ? Math.max(1, Number(activePart.qty) || 1)
        : Infinity
    let highlightedSoFar = 0
    for (let i = 0; i < matchFlags.length; i++) {
      if (matchFlags[i]) {
        if (highlightedSoFar < maxExpectedHighlights) {
          highlightedSoFar += 1
        } else {
          matchFlags[i] = false
        }
      }
    }

    const hasAnySelectedMesh = matchFlags.some(Boolean)

    meshes.forEach((mesh, idx) => {
      const isSelected = matchFlags[idx]

      if (mesh.material) {
        if (isSelected) {
          // Bright Industrial Yellow (#FACC15) with full visibility whether assembled or exploded
          mesh.material.color.setHex(0xfacc15)
          mesh.material.emissive.setHex(0xca8a04)
          mesh.material.emissiveIntensity = 0.25
          mesh.material.opacity = 0.98
          mesh.material.transparent = true
          mesh.material.depthWrite = true
        } else if (isUploadedModel) {
          mesh.material.color.setHex(0xf3f4f6)
          mesh.material.roughness = 0.4
          mesh.material.metalness = 0.05
          mesh.material.emissive.setHex(0x000000)
          mesh.material.emissiveIntensity = 0
          mesh.material.opacity = hasAnySelectedMesh ? 0.32 : 1.0
          mesh.material.transparent = hasAnySelectedMesh
          mesh.material.depthWrite = !hasAnySelectedMesh
        } else {
          mesh.material.color.setHex(0x1f2937)
          mesh.material.emissive.setHex(0x000000)
          mesh.material.emissiveIntensity = 0
          mesh.material.opacity = 0.28
          mesh.material.transparent = true
          mesh.material.depthWrite = false
        }
        mesh.material.needsUpdate = true
      }

      const edgeLine = mesh.children.find((c) => c.userData?.isEdgeOutline)
      if (edgeLine && edgeLine.material) {
        if (isSelected) {
          edgeLine.material.color.setHex(0x111827)
          edgeLine.material.opacity = 1.0
        } else if (isUploadedModel) {
          edgeLine.material.color.setHex(0x1f2937)
          edgeLine.material.opacity = hasAnySelectedMesh ? 0.55 : 0.95
        } else {
          edgeLine.material.color.setHex(0x9ca3af)
          edgeLine.material.opacity = 0.75
        }
        edgeLine.material.needsUpdate = true
      }
    })
  }

  const applyVisualStyles = () => {
    highlightMeshByIndex(selectedPartIndex)
  }

  // Auto-scale camera, clipping planes, OrbitControls, and ground grid to fit any unit scale
  const fitCameraAndGridToBox = (box, isIsometricReset = true) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const grid = gridHelperRef.current
    if (!camera || !controls || box.isEmpty()) return

    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)

    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const fov = camera.fov * (Math.PI / 180)
    const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.65

    const direction = isIsometricReset
      ? new THREE.Vector3(1.15, 0.85, 1.25).normalize()
      : camera.position.clone().sub(controls.target).normalize()

    if (direction.lengthSq() < 0.0001) {
      direction.set(1.15, 0.85, 1.25).normalize()
    }

    const newPos = center.clone().add(direction.multiplyScalar(distance))

    camera.near = Math.max(0.001, maxDim / 500)
    camera.far = Math.max(100, maxDim * 50)
    camera.position.copy(newPos)
    camera.updateProjectionMatrix()

    controls.minDistance = maxDim * 0.15
    controls.maxDistance = maxDim * 12
    controls.target.copy(center)
    controls.update()

    if (grid && isIsometricReset) {
      const gridScale = (maxDim * 2.5) / 1800
      grid.scale.set(gridScale, gridScale, gridScale)
      grid.position.set(center.x, box.min.y - maxDim * 0.005, center.z)
    }

    if (isIsometricReset) {
      defaultCameraPosRef.current.copy(newPos)
      defaultTargetRef.current.copy(center)
    }
  }

  // Build procedural 3D wireframe preset ('kitchen', 'wardrobe', or 'drawer_bank')
  const buildProceduralPreset = (type = 'kitchen') => {
    const group = cabinetGroupRef.current
    if (!group) return
    clearGroup(group)
    isCustomModelRef.current = false

    const preset = PRESET_CONFIGS[type] || PRESET_CONFIGS.kitchen

    preset.panels.forEach((panel, idx) => {
      const [w, h, d] = panel.dims
      const geometry = new THREE.BoxGeometry(w, h, d)
      const material = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.45,
        metalness: 0.15,
        transparent: true,
        opacity: 0.28,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.uuid = panel.key
      mesh.position.set(...panel.pos)
      mesh.name = panel.partName
      mesh.userData = {
        key: panel.key,
        meshUuid: panel.key,
        partName: panel.partName,
        panelRole: panel.partName,
        category: panel.category,
        panelIndex: idx,
        partIndex: idx,
        displayDims: panel.displayDims,
        basePosition: mesh.position.clone(),
      }

      // Anchor wireframe edge outline as child object of mesh so it displaces seamlessly
      const edgesGeo = new THREE.EdgesGeometry(geometry)
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0x9ca3af,
        transparent: true,
        opacity: 0.75,
      })
      const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat)
      edgeLines.userData = { isEdgeOutline: true }
      mesh.add(edgeLines)

      group.add(mesh)
      meshListRef.current.push(mesh)
    })

    // Run automated bounding-box classification & outward explosion vector calculation
    classifyCabinetPanels(group, { preserveExplicitName: true })

    if (explodeProgressRef.current > 0) {
      updateExplodedPositions(explodeProgressRef.current)
    }

    const box = new THREE.Box3().setFromObject(group)
    fitCameraAndGridToBox(box, true)
    applyVisualStyles()
    setModelStatus(preset.label)
    setModelBoundsSummary(preset.bounds)
  }

  // Mount uploaded 3D model (.dae or .obj) with compound mesh decomposition, redundant top merging & role classification
  const mountLoadedModel = (loadedObject, label = 'Uploaded 3D Model') => {
    const group = cabinetGroupRef.current
    if (!group || !loadedObject) return

    clearGroup(group)
    isCustomModelRef.current = true

    // 1. Normalize units to mm, decompose compound meshes (`minDim > 25 mm`), and merge redundant top faces
    const { meshes: normalizedMeshes } = normalizeLoadedCabinetModel(loadedObject)
    if (normalizedMeshes.length === 0) {
      buildProceduralPreset(presetType)
      return
    }

    // 2. Compute overall cabinet assembly bounding box & classify every discrete panel & hardware mesh
    const assemblyBox = new THREE.Box3().setFromObject(loadedObject)
    const {
      panels: classifiedPanels,
      hardware: classifiedHardware = [],
    } = classifyCabinetPanels(loadedObject, {
      tolerance: 10,
      preserveExplicitName: false,
    })

    const extractedCutlistParts = []
    const timestamp = Date.now()

    classifiedPanels.forEach((rec, meshIdx) => {
      const child = rec.mesh
      const assignedRole = rec.role

      child.material = new THREE.MeshStandardMaterial({
        color: 0xf3f4f6,
        roughness: 0.4,
        metalness: 0.05,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })

      // Anchor wireframe EdgesGeometry / LineSegments as a child of each mesh so it displaces seamlessly
      const edgesGeo = new THREE.EdgesGeometry(child.geometry, 15)
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0x1f2937,
        transparent: true,
        opacity: 0.95,
      })
      const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat)
      edgeLines.userData = { isEdgeOutline: true }
      child.add(edgeLines)

      const sortedDims = [rec.dx, rec.dy, rec.dz]
        .map((v) => Math.max(1, Math.round(v)))
        .sort((a, b) => b - a)

      const generatedPartId = `cad-${timestamp}-${meshIdx}`

      // Store assigned role in `mesh.userData.panelRole`, `mesh.name`, `meshUuid`, and unique panel index
      child.name = assignedRole
      child.userData = {
        ...child.userData,
        key: `cad-mesh-${meshIdx}`,
        meshUuid: child.uuid,
        panelRole: assignedRole,
        partName: assignedRole,
        category: assignedRole.toLowerCase(),
        panelIndex: meshIdx,
        partIndex: meshIdx,
        partId: generatedPartId,
        basePosition: child.position.clone(),
        explodeDir: rec.explodeDir.clone(),
        displayDims: `${sortedDims[0]} × ${sortedDims[1]} × ${sortedDims[2]} mm`,
      }

      extractedCutlistParts.push({
        id: generatedPartId,
        meshUuid: child.uuid,
        meshUuids: [child.uuid],
        panelIndex: meshIdx,
        panelIndices: [meshIdx],
        partIndex: meshIdx,
        num: `#${meshIdx + 1}`,
        part: assignedRole,
        panelRole: assignedRole,
        qty: 1,
        l: sortedDims[0],
        w: sortedDims[1],
        h: sortedDims[2],
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
      })

      meshListRef.current.push(child)
    })

    // 3. Preserve cabinet feet / hardware in the 3D scene with wireframe outlines & consolidate into bottom spec note
    const extractedHardwareItems = []
    if (classifiedHardware.length > 0) {
      const hwGroupId = `hw-${timestamp}-footing`
      const hwMeshUuids = []
      const hwDimsList = []

      classifiedHardware.forEach((hwRec, hwIdx) => {
        const hwMesh = hwRec.mesh
        const assignedRole = hwRec.role || 'Cabinet Foot / Leg'

        hwMesh.material = new THREE.MeshStandardMaterial({
          color: 0xf3f4f6,
          roughness: 0.4,
          metalness: 0.05,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })

        const edgesGeo = new THREE.EdgesGeometry(hwMesh.geometry, 15)
        const edgesMat = new THREE.LineBasicMaterial({
          color: 0x1f2937,
          transparent: true,
          opacity: 0.95,
        })
        const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat)
        edgeLines.userData = { isEdgeOutline: true }
        hwMesh.add(edgeLines)

        const sortedDims = [hwRec.dx, hwRec.dy, hwRec.dz]
          .map((v) => Math.max(1, Math.round(v)))
          .sort((a, b) => b - a)

        hwDimsList.push(sortedDims)
        hwMeshUuids.push(hwMesh.uuid)

        hwMesh.name = assignedRole
        hwMesh.userData = {
          ...hwMesh.userData,
          key: `cad-hw-${hwIdx}`,
          meshUuid: hwMesh.uuid,
          isHardware: true,
          type: 'hardware',
          category: 'footing',
          panelRole: assignedRole,
          partName: assignedRole,
          partId: hwGroupId,
          basePosition: hwMesh.position.clone(),
          explodeDir: hwRec.explodeDir.clone(),
          displayDims: `${sortedDims[0]} × ${sortedDims[1]} × ${sortedDims[2]} mm`,
        }

        meshListRef.current.push(hwMesh)
      })

      const repDims = hwDimsList[0] || [53, 38, 38]
      extractedHardwareItems.push({
        id: hwGroupId,
        num: 'HW',
        type: 'hardware',
        isHardware: true,
        category: 'footing',
        title: 'Hardware / Leg Assemblies (Non-Sheet Stock)',
        part: 'Cabinet Foot / Leg',
        panelRole: 'Cabinet Foot / Leg',
        qty: classifiedHardware.length,
        l: repDims[0],
        w: repDims[1],
        h: repDims[2],
        remarks: 'Solid hardware component — excluded from 18mm sheet cutlist',
        meshUuids: hwMeshUuids,
        consolidated: classifiedHardware.length > 1,
      })
    }

    if (typeof onModelPartsExtractedRef.current === 'function') {
      onModelPartsExtractedRef.current(
        extractedCutlistParts,
        label,
        extractedHardwareItems
      )
    }

    group.add(loadedObject)
    loadedObject.updateMatrixWorld(true)

    if (explodeProgressRef.current > 0) {
      updateExplodedPositions(explodeProgressRef.current)
    }

    const centeredBox = new THREE.Box3().setFromObject(group)
    fitCameraAndGridToBox(centeredBox, true)
    applyVisualStyles()

    const size = assemblyBox.getSize(new THREE.Vector3())
    setModelBoundsSummary({
      w: Math.max(1, Math.round(size.x)),
      h: Math.max(1, Math.round(size.y)),
      d: Math.max(1, Math.round(size.z)),
    })
    const panelCount = classifiedPanels.length
    const hwCount = classifiedHardware.length
    setModelStatus(
      hwCount > 0
        ? `${label} (${panelCount} ${panelCount === 1 ? 'panel' : 'panels'} · ${hwCount} feet)`
        : `${label} (${panelCount} ${panelCount === 1 ? 'panel' : 'panels'})`
    )
  }

  // 1. Initialize Three.js Scene, Camera, Lighting, Grid, OrbitControls, and Raycaster
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const width = container.clientWidth || 380
    const height = container.clientHeight || 320

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 20000)
    camera.position.copy(defaultCameraPosRef.current)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambientLight)

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x9ca3af, 0.55)
    hemiLight.position.set(0, 1000, 0)
    scene.add(hemiLight)

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight1.position.set(800, 1200, 900)
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5)
    dirLight2.position.set(-700, -400, -800)
    scene.add(dirLight2)

    const gridHelper = new THREE.GridHelper(1800, 18, 0xeab308, 0x374151)
    scene.add(gridHelper)
    gridHelperRef.current = gridHelper

    const cabinetGroup = new THREE.Group()
    scene.add(cabinetGroup)
    cabinetGroupRef.current = cabinetGroup

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.copy(defaultTargetRef.current)
    controls.update()
    controlsRef.current = controls

    buildProceduralPreset(presetType)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let pointerDownPos = { x: 0, y: 0 }

    const getIntersects = (event) => {
      if (!containerRef.current) return []
      const rect = containerRef.current.getBoundingClientRect()
      if (!rect.width || !rect.height) return []
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      cabinetGroup.updateMatrixWorld(true)
      raycaster.setFromCamera(mouse, camera)
      return raycaster.intersectObjects(meshListRef.current, false)
    }

    const handlePointerDown = (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY }
    }

    const handlePointerMove = (e) => {
      const hits = getIntersects(e)
      if (hits.length > 0) {
        const hitMesh = hits[0].object
        canvas.style.cursor = 'pointer'
        setHoveredPanel({
          partName: hitMesh.userData.panelRole || hitMesh.userData.partName,
          displayDims: hitMesh.userData.displayDims,
        })
      } else {
        canvas.style.cursor = 'grab'
        setHoveredPanel(null)
      }
    }

    const handlePointerUp = (e) => {
      const dx = Math.abs(e.clientX - pointerDownPos.x)
      const dy = Math.abs(e.clientY - pointerDownPos.y)
      if (dx > 6 || dy > 6) return

      const hits = getIntersects(e)
      if (hits.length > 0 && onSelectPartRef.current) {
        const hitMesh = hits[0].object
        const hitUuid = hitMesh.uuid
        const hitData = hitMesh.userData
        const currentParts = partsRef.current || []
        const currentHardware = hardwareItemsRef.current || []

        // 0. Check if clicked mesh is a Cabinet Foot / Hardware component
        if (hitData.isHardware || hitData.type === 'hardware') {
          const matchedHw =
            currentHardware.find(
              (hw) =>
                (Array.isArray(hw.meshUuids) && hw.meshUuids.includes(hitUuid)) ||
                hw.id === hitData.partId ||
                hw.type === 'hardware'
            ) || null
          if (matchedHw) {
            onSelectPartRef.current(matchedHw.id, matchedHw, hitData)
            return
          }
          onSelectPartRef.current(hitData.partId || 'hw-footing', null, hitData)
          return
        }

        let matchedRow = null
        // 1. Map clicked mesh's UUID back to the consolidated or individual part record (`meshUuids`)
        if (hitUuid) {
          matchedRow = currentParts.find(
            (p) =>
              (Array.isArray(p.meshUuids) && p.meshUuids.includes(hitUuid)) ||
              p.meshUuid === hitUuid
          )
        }
        // 2. Match by unique partId
        if (!matchedRow && hitData.partId) {
          matchedRow = currentParts.find((p) => p.id === hitData.partId)
        }
        // 3. Match by panelIndices / panelIndex
        if (!matchedRow && typeof hitData.panelIndex === 'number') {
          matchedRow = currentParts.find(
            (p) =>
              (Array.isArray(p.panelIndices) &&
                p.panelIndices.includes(hitData.panelIndex)) ||
              p.panelIndex === hitData.panelIndex
          )
        }
        // 4. Match by classified panelRole / partName
        if (!matchedRow) {
          matchedRow = currentParts.find((p) =>
            doesMeshMatchSelectedPart(hitData, p, p.part, null, hitUuid)
          )
        }
        // 5. Fallback to partIndex
        if (!matchedRow && typeof hitData.partIndex === 'number') {
          matchedRow = currentParts[hitData.partIndex] || null
        }

        if (matchedRow) {
          onSelectPartRef.current(matchedRow.id, matchedRow)
        } else {
          onSelectPartRef.current(hitData.partId || null, null, hitData)
        }
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
      const w = containerRef.current.clientWidth || 380
      const h = containerRef.current.clientHeight || 320
      rendererRef.current.setSize(w, h)
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      if (selectedPartIndexRef.current !== null) {
        highlightMeshByIndex(selectedPartIndexRef.current)
      }
    })
    resizeObserver.observe(container)

    let animFrameId = null
    const animate = () => {
      animFrameId = requestAnimationFrame(animate)

      const currentExplodeProgress = explodeProgressRef.current
      const meshes = meshListRef.current
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i]
        if (mesh.userData?.basePosition && mesh.userData?.explodeDir) {
          mesh.position
            .copy(mesh.userData.basePosition)
            .addScaledVector(
              mesh.userData.explodeDir,
              EXPLODE_MAX_DISTANCE_MM * currentExplodeProgress
            )
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId)
      if (explodeAnimFrameRef.current) cancelAnimationFrame(explodeAnimFrameRef.current)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      controls.dispose()
      clearGroup(cabinetGroup)
      gridHelper.geometry?.dispose()
      if (Array.isArray(gridHelper.material)) {
        gridHelper.material.forEach((m) => m.dispose())
      } else {
        gridHelper.material?.dispose()
      }
      renderer.dispose()
    }
  }, [])

  // Window resize & fullscreenchange listener that forces re-application of active selection highlight
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      if (!width || !height) return
      rendererRef.current.setSize(width, height)
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()

      // Force re-apply active selection highlight
      if (selectedPartIndex !== null) {
        highlightMeshByIndex(selectedPartIndex)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    document.addEventListener('fullscreenchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('fullscreenchange', handleResize)
    }
  }, [selectedPartIndex, isExpanded])

  // 2. Per-Project 3D Viewport Synchronization
  useEffect(() => {
    if (!modelUrl && !modelFile) {
      buildProceduralPreset(presetType)
      return
    }

    const fileName =
      modelFile?.name ||
      (typeof modelUrl === 'string' ? modelUrl.split('/').pop() : '') ||
      'Uploaded Model'
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const mimeType = modelFile?.type?.toLowerCase() || ''

    const isDae = ext === 'dae' || mimeType.includes('collada')
    const isObj = ext === 'obj'

    if (isDae && modelUrl) {
      const colladaLoader = new ColladaLoader()
      colladaLoader.load(
        modelUrl,
        (collada) => {
          if (collada && collada.scene) {
            mountLoadedModel(collada.scene, fileName)
          } else {
            buildProceduralPreset(presetType)
          }
        },
        undefined,
        () => {
          buildProceduralPreset(presetType)
        }
      )
      return
    }

    if (isObj && modelUrl) {
      const objLoader = new OBJLoader()
      objLoader.load(
        modelUrl,
        (objGroup) => {
          mountLoadedModel(objGroup, fileName)
        },
        undefined,
        () => {
          buildProceduralPreset(presetType)
        }
      )
      return
    }

    if (modelFile instanceof File && (isDae || isObj)) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result
        if (typeof text !== 'string') return
        if (isDae) {
          const collada = new ColladaLoader().parse(text, '')
          if (collada?.scene) mountLoadedModel(collada.scene, fileName)
        } else {
          const objGroup = new OBJLoader().parse(text)
          mountLoadedModel(objGroup, fileName)
        }
      }
      reader.readAsText(modelFile)
      return
    }

    buildProceduralPreset(presetType)
  }, [modelUrl, modelFile, presetType])

  // 3. Sync Two-Way Selection Highlighting
  useEffect(() => {
    highlightMeshByIndex(selectedPartIndex)
  }, [selectedPart, selectedPartIndex, selectedPartName, parts])

  // 4a. Zoom / Focus on Selected Part Bounding Box
  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const group = cabinetGroupRef.current
    if (!camera || !controls || !group) return

    const matchingMeshes = meshListRef.current.filter((m) =>
      doesMeshMatchSelectedPart(
        m.userData,
        selectedPart,
        selectedPartName,
        selectedPartIndex,
        m.uuid
      )
    )

    if (focusTrigger > 0) {
      if (matchingMeshes.length > 0) {
        const targetBox = new THREE.Box3()
        matchingMeshes.forEach((m) => {
          const b = new THREE.Box3().setFromObject(m)
          targetBox.union(b)
        })
        fitCameraAndGridToBox(targetBox, false)
      } else {
        const fullBox = new THREE.Box3().setFromObject(group)
        fitCameraAndGridToBox(fullBox, false)
      }
      return
    }

    if (zoom && zoom !== 1) {
      const dir = camera.position.clone().sub(controls.target)
      const baseDist = defaultCameraPosRef.current.distanceTo(defaultTargetRef.current)
      dir.normalize().multiplyScalar(baseDist / zoom)
      camera.position.copy(controls.target).add(dir)
      controls.update()
    }
  }, [zoom, focusTrigger])

  // 4b. Rotate / Isometric Reset Trigger
  useEffect(() => {
    const group = cabinetGroupRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!group || !camera || !controls) return

    if (resetTrigger > 0) {
      group.rotation.y = 0
      const fullBox = new THREE.Box3().setFromObject(group)
      fitCameraAndGridToBox(fullBox, true)
      return
    }

    group.rotation.y = (rotation * Math.PI) / 180
  }, [rotation, resetTrigger])

  const selectedLabel = selectedPart
    ? isAmbiguousCadName(selectedPart.part || selectedPart.part_name)
      ? selectedPart.panelRole || selectedPart.part || selectedPart.part_name
      : selectedPart.part || selectedPart.part_name
    : ''

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] bg-[#111827] flex items-center justify-center overflow-hidden select-none rounded-xl"
    >
      {/* Interactive Three.js WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block outline-none" />

      {/* Top-Left HUD Badge: Active Model & Controls Hint */}
      <div className="absolute top-2.5 left-2.5 pointer-events-none flex flex-col gap-1">
        <div className="inline-flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700 text-zinc-200 px-2.5 py-1 rounded-md text-[10.5px] font-semibold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#FACC15] inline-block" />
          <span>{modelStatus}</span>
          {explodeProgress > 0.01 && (
            <span className="ml-1 px-1.5 py-0.2 rounded bg-[#FACC15] text-zinc-950 text-[9.5px] font-extrabold">
              EXPLODED {Math.round(explodeProgress * 100)}%
            </span>
          )}
        </div>
        <div className="inline-flex items-center gap-2 text-[10px] text-zinc-400 bg-zinc-950/75 px-2 py-0.5 rounded border border-zinc-800 w-fit">
          <span>Orbit: Drag · Zoom: Scroll · Click Panel to Select</span>
        </div>
      </div>

      {/* Top-Right HUD Dimension Callout for Active/Hovered Part */}
      {(hoveredPanel || selectedPart) && (
        <div className="absolute top-2.5 right-2.5 pointer-events-none bg-zinc-950/90 border border-[#FACC15] text-zinc-100 px-2.5 py-1.5 rounded-lg text-[11px] shadow-md max-w-[230px]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#FACC15]">
            {hoveredPanel
              ? 'Inspecting 3D Panel'
              : selectedPart?.type === 'hardware' || selectedPart?.isHardware
              ? 'Selected Hardware / Fitting'
              : 'Selected Cut Plane'}
          </div>
          <div className="font-bold text-white truncate">
            {hoveredPanel
              ? hoveredPanel.partName
              : selectedPart?.type === 'hardware' || selectedPart?.isHardware
              ? `${selectedLabel} (×${selectedPart.qty || 1})`
              : `${selectedPart.num || ''} ${selectedLabel}`}
          </div>
          <div className="text-[10.5px] text-zinc-300 font-mono">
            {hoveredPanel
              ? hoveredPanel.displayDims
              : `${fmt(selectedPart.l)} × ${fmt(selectedPart.w)} × ${fmt(selectedPart.h)}`}
          </div>
        </div>
      )}

      {/* Bottom-Left Overall Cabinet Dimension Reference Pill */}
      <div className="absolute bottom-3 left-3 pointer-events-none hidden sm:flex items-center gap-1.5 bg-zinc-900/85 border border-zinc-700 text-zinc-300 px-2.5 py-1 rounded-md text-[10.5px] font-mono">
        <span>W: {fmt(modelBoundsSummary.w)}</span>
        <span className="text-zinc-600">·</span>
        <span>D: {fmt(modelBoundsSummary.d)}</span>
        <span className="text-zinc-600">·</span>
        <span>H: {fmt(modelBoundsSummary.h)}</span>
      </div>

      {/* Bottom-Right Floating Action Capsule (Explode, Focus/Zoom, Reset, Expand/Minimize) */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
        <button
          type="button"
          title="Toggle Exploded View"
          aria-label="Toggle Exploded View"
          aria-pressed={isExploded}
          onClick={handleToggleExplode}
          className={`h-8 px-2.5 rounded-full border shadow-sm flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
            isExploded || explodeProgress > 0.05
              ? 'bg-[#FACC15] text-zinc-950 border-[#EAB308] hover:bg-[#EAB308]'
              : 'bg-white dark:bg-zinc-800 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-950'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold">Explode</span>
        </button>

        {onFocusCamera && (
          <button
            type="button"
            title="Focus on Selected Part Bounding Box"
            onClick={onFocusCamera}
            className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] border border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-950 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {onResetCamera && (
          <button
            type="button"
            title="Reset Camera to Isometric View"
            onClick={onResetCamera}
            className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] border border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-950 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {onExpandViewer && (
          <button
            type="button"
            title={isExpanded ? 'Exit Fullscreen 3D Viewer' : 'Fullscreen / Expand 3D Viewer'}
            onClick={onExpandViewer}
            className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] border border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308] shadow-sm flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-950 transition-all"
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
