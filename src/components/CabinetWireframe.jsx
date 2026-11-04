import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { formatDimensionByUnit, normalizeUnitCode } from '../utils/exporter'

/**
 * Interactive 3D WebGL Cabinet Viewer (`src/components/CabinetWireframe.jsx`)
 * Supports:
 *  - Per-project procedural 3D wireframe presets (`kitchen`, `wardrobe`, `drawer_bank`)
 *  - Per-project uploaded 3D models (`.dae` via `ColladaLoader` and `.obj` via `OBJLoader`)
 *  - Automatic clearing/switching when the active project changes in `App.jsx`
 */

// 1. Job #1 Preset: Base Kitchen Cabinet (750mm W x 500mm H x 500mm D)
const KITCHEN_CABINET_PANELS = [
  { key: 'k-left-side', partName: 'Side Panel', category: 'side', dims: [18, 500, 500], pos: [-366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'k-right-side', partName: 'Side Panel', category: 'side', dims: [18, 500, 500], pos: [366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'k-top-panel', partName: 'Top Panel', category: 'top', dims: [750, 18, 500], pos: [0, 241, 0], displayDims: '600 × 500 × 18 mm' },
  { key: 'k-bottom-deck', partName: 'Base Shelf', category: 'bottom', dims: [714, 18, 480], pos: [0, -181, 0], displayDims: '564 × 480 × 18 mm' },
  { key: 'k-mid-shelf', partName: 'Adjustable Shelf', category: 'shelf', dims: [714, 18, 460], pos: [0, 25, -10], displayDims: '564 × 480 × 18 mm' },
  { key: 'k-top-stretcher', partName: 'Top Stretcher', category: 'stretcher', dims: [714, 18, 100], pos: [0, 214, -190], displayDims: '564 × 100 × 18 mm' },
  { key: 'k-door-left', partName: 'Cabinet Door Slab', category: 'door', dims: [354, 410, 18], pos: [-180, 24, 252], displayDims: '746 × 296 × 18 mm' },
]

// 2. Job #2 Preset: Tall Wardrobe Carcass (900mm W x 2100mm H x 600mm D)
const WARDROBE_CABINET_PANELS = [
  { key: 'w-left-gable', partName: 'Wardrobe Tall Gable', category: 'side', dims: [18, 2100, 600], pos: [-441, 0, 0], displayDims: '2100 × 600 × 18 mm' },
  { key: 'w-right-gable', partName: 'Wardrobe Tall Gable', category: 'side', dims: [18, 2100, 600], pos: [441, 0, 0], displayDims: '2100 × 600 × 18 mm' },
  { key: 'w-center-divider', partName: 'Side Panel', category: 'side', dims: [18, 1964, 580], pos: [0, -50, -5], displayDims: '750 × 500 × 18 mm' },
  { key: 'w-top-cap', partName: 'Top Panel', category: 'top', dims: [900, 18, 600], pos: [0, 1041, 0], displayDims: '600 × 500 × 18 mm' },
  { key: 'w-bottom-deck', partName: 'Fixed Shelf', category: 'bottom', dims: [864, 18, 580], pos: [0, -950, 0], displayDims: '564 × 480 × 18 mm' },
  { key: 'w-upper-shelf', partName: 'Fixed Shelf', category: 'shelf', dims: [864, 18, 580], pos: [0, 580, 0], displayDims: '564 × 480 × 18 mm' },
  { key: 'w-mid-shelf-1', partName: 'Fixed Shelf', category: 'shelf', dims: [423, 18, 560], pos: [215, 120, -5], displayDims: '564 × 480 × 18 mm' },
  { key: 'w-mid-shelf-2', partName: 'Fixed Shelf', category: 'shelf', dims: [423, 18, 560], pos: [215, -350, -5], displayDims: '564 × 480 × 18 mm' },
  { key: 'w-valance-rail', partName: 'Valance Rail', category: 'rail', dims: [864, 100, 18], pos: [0, -1000, 282], displayDims: '864 × 100 × 18 mm' },
]

// 3. Job #3 Preset: 3-Tier Workshop Drawer Bank Carcass (750mm W x 750mm H x 500mm D)
const DRAWER_BANK_PANELS = [
  { key: 'd-left-side', partName: 'Side Panel', category: 'side', dims: [18, 750, 500], pos: [-366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'd-right-side', partName: 'Side Panel', category: 'side', dims: [18, 750, 500], pos: [366, 0, 0], displayDims: '750 × 500 × 18 mm' },
  { key: 'd-top-stretcher-f', partName: 'Stretcher Rail', category: 'stretcher', dims: [714, 18, 100], pos: [0, 366, 195], displayDims: '564 × 100 × 18 mm' },
  { key: 'd-top-stretcher-b', partName: 'Stretcher Rail', category: 'stretcher', dims: [714, 18, 100], pos: [0, 366, -195], displayDims: '564 × 100 × 18 mm' },
  { key: 'd-bottom-stretcher', partName: 'Stretcher Rail', category: 'stretcher', dims: [714, 18, 480], pos: [0, -330, 0], displayDims: '564 × 100 × 18 mm' },
  // 3 Drawer Front Faces + Drawer Box Sides
  { key: 'd-front-top', partName: 'Drawer Front Face', category: 'door', dims: [738, 210, 18], pos: [0, 235, 255], displayDims: '746 × 296 × 18 mm' },
  { key: 'd-box-top-l', partName: 'Drawer Box Side', category: 'side', dims: [18, 160, 450], pos: [-330, 235, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-box-top-r', partName: 'Drawer Box Side', category: 'side', dims: [18, 160, 450], pos: [330, 235, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-front-mid', partName: 'Drawer Front Face', category: 'door', dims: [738, 210, 18], pos: [0, 10, 255], displayDims: '746 × 296 × 18 mm' },
  { key: 'd-box-mid-l', partName: 'Drawer Box Side', category: 'side', dims: [18, 160, 450], pos: [-330, 10, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-box-mid-r', partName: 'Drawer Box Side', category: 'side', dims: [18, 160, 450], pos: [330, 10, 15], displayDims: '450 × 160 × 18 mm' },
  { key: 'd-front-bot', partName: 'Drawer Front Face', category: 'door', dims: [738, 210, 18], pos: [0, -215, 255], displayDims: '746 × 296 × 18 mm' },
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
function doesMeshMatchSelectedPart(meshUserData, selectedPart, selectedPartName, selectedPartIndex) {
  if (!selectedPart && !selectedPartName && selectedPartIndex == null) return false

  if (selectedPart && meshUserData.partId && meshUserData.partId === selectedPart.id) {
    return true
  }
  if (
    typeof selectedPartIndex === 'number' &&
    selectedPartIndex >= 0 &&
    meshUserData.partIndex === selectedPartIndex
  ) {
    return true
  }

  const targetName = String(
    selectedPart?.part || selectedPart?.part_name || selectedPartName || ''
  )
    .toLowerCase()
    .trim()
  if (!targetName) return false

  const meshName = String(meshUserData.partName || meshUserData.name || '')
    .toLowerCase()
    .trim()
  const category = String(meshUserData.category || '').toLowerCase()

  if (meshName && (meshName === targetName || meshName.includes(targetName) || targetName.includes(meshName))) {
    return true
  }

  if (targetName.includes('side') || targetName.includes('gable')) {
    return category === 'side' || meshName.includes('side') || meshName.includes('gable')
  }
  if (targetName.includes('shelf') || targetName.includes('shelves')) {
    return category === 'shelf' || category === 'bottom' || meshName.includes('shelf')
  }
  if (targetName.includes('top') && targetName.includes('stretcher')) {
    return category === 'stretcher' || meshName.includes('stretcher')
  }
  if (targetName.includes('top')) {
    return category === 'top' || meshName.includes('top')
  }
  if (targetName.includes('door') || targetName.includes('front') || targetName.includes('slab')) {
    return category === 'door' || meshName.includes('door')
  }
  if (targetName.includes('rail') || targetName.includes('valance') || targetName.includes('stretcher')) {
    return category === 'rail' || category === 'stretcher' || meshName.includes('rail')
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
  presetType = 'kitchen',
  modelFile = null,
  modelUrl = null,
  onSelectPart = null,
  onModelPartsExtracted = null,
  focusTrigger = 0,
  resetTrigger = 0,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const gridHelperRef = useRef(null)
  const cabinetGroupRef = useRef(null)
  const meshesRef = useRef([])
  const isCustomModelRef = useRef(false)
  const defaultCameraPosRef = useRef(new THREE.Vector3(920, 680, 960))
  const defaultTargetRef = useRef(new THREE.Vector3(0, 0, 0))

  const [hoveredPanel, setHoveredPanel] = useState(null)
  const [modelStatus, setModelStatus] = useState(PRESET_CONFIGS.kitchen.label)
  const [modelBoundsSummary, setModelBoundsSummary] = useState(PRESET_CONFIGS.kitchen.bounds)

  const partsRef = useRef(parts)
  partsRef.current = parts
  const onSelectPartRef = useRef(onSelectPart)
  onSelectPartRef.current = onSelectPart
  const onModelPartsExtractedRef = useRef(onModelPartsExtracted)
  onModelPartsExtractedRef.current = onModelPartsExtracted

  const fmt = (mm) => {
    const code = normalizeUnitCode(unit)
    return `${formatDimensionByUnit(mm, code)} ${code}`
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
    meshesRef.current = []
  }

  // Apply workshop styling for either procedural presets or uploaded CAD models
  const applyVisualStyles = () => {
    const meshes = meshesRef.current
    if (!meshes || meshes.length === 0) return

    const isUploadedModel = isCustomModelRef.current

    meshes.forEach((mesh) => {
      const isSelected = doesMeshMatchSelectedPart(
        mesh.userData,
        selectedPart,
        selectedPartName,
        selectedPartIndex
      )

      if (mesh.material) {
        if (isSelected) {
          mesh.material.color.setHex(0xfacc15) // Industrial Yellow (#FACC15)
          mesh.material.emissive.setHex(0xca8a04)
          mesh.material.emissiveIntensity = 0.2
          mesh.material.opacity = 0.95
          mesh.material.transparent = true
          mesh.material.depthWrite = true
        } else if (isUploadedModel) {
          // Crisp white/light-gray matte finish for uploaded .dae / .obj models
          mesh.material.color.setHex(0xf3f4f6)
          mesh.material.roughness = 0.4
          mesh.material.metalness = 0.05
          mesh.material.emissive.setHex(0x000000)
          mesh.material.emissiveIntensity = 0
          mesh.material.opacity = 1.0
          mesh.material.transparent = false
          mesh.material.depthWrite = true
        } else {
          // Semi-transparent dark charcoal for procedural presets
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
          edgeLine.material.opacity = 0.95
        } else {
          edgeLine.material.color.setHex(0x9ca3af)
          edgeLine.material.opacity = 0.75
        }
        edgeLine.material.needsUpdate = true
      }
    })
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
      mesh.position.set(...panel.pos)
      mesh.userData = {
        key: panel.key,
        partName: panel.partName,
        category: panel.category,
        partIndex: idx,
        displayDims: panel.displayDims,
      }

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
      meshesRef.current.push(mesh)
    })

    const box = new THREE.Box3().setFromObject(group)
    fitCameraAndGridToBox(box, true)
    applyVisualStyles()
    setModelStatus(preset.label)
    setModelBoundsSummary(preset.bounds)
  }

  // Mount uploaded 3D model (.dae or .obj)
  const mountLoadedModel = (loadedObject, label = 'Uploaded 3D Model') => {
    const group = cabinetGroupRef.current
    if (!group || !loadedObject) return

    clearGroup(group)
    isCustomModelRef.current = true

    const strayLines = []
    loadedObject.traverse((child) => {
      if ((child.isLine || child.isLineSegments) && !child.userData?.isEdgeOutline) {
        strayLines.push(child)
      }
    })
    strayLines.forEach((ln) => ln.parent?.remove(ln))

    let meshIdx = 0
    const extractedCutlistParts = []
    loadedObject.traverse((child) => {
      if (child.isMesh && child.geometry) {
        child.geometry.computeVertexNormals()
        child.geometry.computeBoundingBox()

        child.material = new THREE.MeshStandardMaterial({
          color: 0xf3f4f6,
          roughness: 0.4,
          metalness: 0.05,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })

        const edgesGeo = new THREE.EdgesGeometry(child.geometry, 15)
        const edgesMat = new THREE.LineBasicMaterial({
          color: 0x1f2937,
          transparent: true,
          opacity: 0.95,
        })
        const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat)
        edgeLines.userData = { isEdgeOutline: true }
        child.add(edgeLines)

        const rawName =
          child.name ||
          child.parent?.name ||
          partsRef.current[meshIdx]?.part ||
          `Panel #${meshIdx + 1}`
        const cleanName = rawName.replace(/_/g, ' ')

        child.updateWorldMatrix(true, false)
        const partBox = new THREE.Box3().setFromObject(child)
        const partSize = new THREE.Vector3()
        partBox.getSize(partSize)

        const maxAxis = Math.max(partSize.x, partSize.y, partSize.z)
        const unitMultiplier = maxAxis < 10 ? 1000 : maxAxis < 100 ? 25.4 : 1
        const sortedDims = [partSize.x, partSize.y, partSize.z]
          .map((v) => Math.max(1, Math.round(v * unitMultiplier)))
          .sort((a, b) => b - a)

        const generatedPartId = partsRef.current[meshIdx]?.id || `cad-${Date.now()}-${meshIdx}`

        child.userData = {
          key: `cad-mesh-${meshIdx}`,
          partName: cleanName,
          category: cleanName.toLowerCase(),
          partIndex: meshIdx,
          partId: generatedPartId,
          displayDims: `${sortedDims[0]} × ${sortedDims[1]} × ${sortedDims[2]} mm`,
        }

        extractedCutlistParts.push({
          id: generatedPartId,
          num: `#${meshIdx + 1}`,
          part: cleanName,
          qty: 1,
          l: sortedDims[0],
          w: sortedDims[1],
          h: sortedDims[2],
          corner: 'Edge 1x',
          material: '18mm Marine Plywood',
        })

        meshesRef.current.push(child)
        meshIdx += 1
      }
    })

    if (meshesRef.current.length === 0) {
      buildProceduralPreset(presetType)
      return
    }

    if (typeof onModelPartsExtractedRef.current === 'function') {
      onModelPartsExtractedRef.current(extractedCutlistParts, label)
    }

    group.add(loadedObject)
    loadedObject.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(loadedObject)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    loadedObject.position.sub(center)
    loadedObject.updateMatrixWorld(true)

    const centeredBox = new THREE.Box3().setFromObject(group)
    fitCameraAndGridToBox(centeredBox, true)
    applyVisualStyles()

    const maxOverall = Math.max(size.x, size.y, size.z)
    const scaleToMm = maxOverall < 10 ? 1000 : maxOverall < 100 ? 25.4 : 1
    setModelBoundsSummary({
      w: Math.round(size.x * scaleToMm),
      h: Math.round(size.y * scaleToMm),
      d: Math.round(size.z * scaleToMm),
    })
    setModelStatus(`${label} (${meshesRef.current.length} ${meshesRef.current.length === 1 ? 'mesh' : 'meshes'})`)
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
    const pointer = new THREE.Vector2()
    let pointerDownPos = { x: 0, y: 0 }

    const getIntersects = (event) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(meshesRef.current, false)
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
          partName: hitMesh.userData.partName,
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
        const hitData = hits[0].object.userData
        const currentParts = partsRef.current || []

        let matchedRow = null
        if (hitData.partId) {
          matchedRow = currentParts.find((p) => p.id === hitData.partId)
        }
        if (!matchedRow) {
          matchedRow = currentParts.find((p) =>
            doesMeshMatchSelectedPart(hitData, p, p.part, null)
          )
        }
        if (!matchedRow && typeof hitData.partIndex === 'number') {
          matchedRow = currentParts[hitData.partIndex] || null
        }

        if (matchedRow) {
          onSelectPartRef.current(matchedRow.id, matchedRow)
        }
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
      const w = containerRef.current.clientWidth || 380
      const h = containerRef.current.clientHeight || 320
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener('resize', handleResize)

    let animFrameId = null
    const animate = () => {
      animFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
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

  // 2. Per-Project 3D Viewport Synchronization:
  // Whenever `modelUrl`, `modelFile`, or `presetType` changes (e.g. switching between Job 1, Job 2, Job 3, or an uploaded Job 4),
  // immediately clear the previous scene and render the active project's model or preset.
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
    applyVisualStyles()
  }, [selectedPart, selectedPartIndex, selectedPartName, parts])

  // 4a. Zoom / Focus on Selected Part Bounding Box
  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const group = cabinetGroupRef.current
    if (!camera || !controls || !group) return

    const matchingMeshes = meshesRef.current.filter((m) =>
      doesMeshMatchSelectedPart(
        m.userData,
        selectedPart,
        selectedPartName,
        selectedPartIndex
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
        </div>
        <div className="inline-flex items-center gap-2 text-[10px] text-zinc-400 bg-zinc-950/75 px-2 py-0.5 rounded border border-zinc-800 w-fit">
          <span>Orbit: Drag · Zoom: Scroll · Click Panel to Select</span>
        </div>
      </div>

      {/* Top-Right HUD Dimension Callout for Active/Hovered Part */}
      {(hoveredPanel || selectedPart) && (
        <div className="absolute top-2.5 right-2.5 pointer-events-none bg-zinc-950/90 border border-[#FACC15] text-zinc-100 px-2.5 py-1.5 rounded-lg text-[11px] shadow-md max-w-[210px]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#FACC15]">
            {hoveredPanel ? 'Inspecting 3D Panel' : 'Selected Cut Plane'}
          </div>
          <div className="font-bold text-white truncate">
            {hoveredPanel
              ? hoveredPanel.partName
              : `${selectedPart.num || ''} ${selectedPart.part || selectedPart.part_name}`}
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
    </div>
  )
}
