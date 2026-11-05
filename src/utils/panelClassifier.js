import * as THREE from 'three'

/**
 * ============================================================================
 * DYNAMIC 3D PANEL CLASSIFIER, COMPOUND MESH DECOMPOSER, SPATIAL DEDUPLICATOR
 * & HARDWARE / FOOTING EXTRACTOR (`src/utils/panelClassifier.js`)
 * ============================================================================
 * 1. Volumetric Solid Preservation:
 *    - If an incoming mesh or connected component is already a flat planar board
 *      (`6 mm <= thickness <= 25 mm` and `width >= 80 mm`, `length >= 100 mm`),
 *      treats it as ONE single panel without splitting or decomposing its faces.
 * 2. Opposing Face Pairing & Spatial Co-Location Deduplication:
 *    - Pairs opposing parallel face clusters separated by board thickness (`<= 25 mm`).
 *    - Spatial Co-Location Filter merges co-located horizontal shelves
 *      (`|Y_center1 - Y_center2| <= 28 mm`), vertical dividers/sides
 *      (`|X_center1 - X_center2| <= 28 mm`), and depth panels
 *      (`|Z_center1 - Z_center2| <= 28 mm`) that share overlapping 2D spans.
 * 3. Hardware & Footing Preservation:
 *    - Preserves all cabinet feet / legs / small hardware meshes in the 3D
 *      scene graph with wireframe outlines and raycast support while segregating
 *      them from the sheet cutting list into a consolidated hardware specification.
 */

export const MIN_BOARD_THICKNESS_MM = 4
export const MAX_BOARD_THICKNESS_MM = 25
export const MIN_SHEET_WIDTH_MM = 80
export const MIN_SHEET_LENGTH_MM = 100
export const MIN_PANEL_SURFACE_AREA_MM2 = 15000 // 0.015 m² = 15,000 mm²
export const COMPOUND_CARCASS_MIN_EXTENT_MM = 50

const AMBIGUOUS_CAD_NAME_PATTERN =
  /^(group[\s_-]*\d*|component[\s_-]*#?\d*|instance[\s_-]*\d*|mesh[\s_-]*\d*|object[\s_-]*\d*|node[\s_-]*\d*|id\d+|sketchup.*|default.*|unnamed.*|panel[\s_-]*#?\d+|cad[\s_-]*model[\s_-]*panel)$/i

/**
 * Returns true if a part/mesh name is an ambiguous auto-generated CAD/SketchUp
 * identifier such as "group 0", "group_1", "Component#1", "ID2", etc.
 */
export function isAmbiguousCadName(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return true
  return AMBIGUOUS_CAD_NAME_PATTERN.test(trimmed)
}

/**
 * Fallback role disambiguator for tabular cutlist rows when only 1D/2D row
 * metadata or index is available.
 */
export function disambiguateCutlistPartName(rawName, rowIndex = 0) {
  const cleaned = String(rawName || '')
    .replace(/_/g, ' ')
    .trim()
  if (!isAmbiguousCadName(cleaned)) {
    return cleaned
  }
  const fallbackRoles = [
    'Side Panel',
    'Top Panel',
    'Bottom Panel',
    'Shelf #1',
    'Back Panel',
    'Vertical Divider',
    'Front Face / Door',
  ]
  return fallbackRoles[rowIndex % fallbackRoles.length]
}

/**
 * Analyzes sorted bounding box extents `[thickness, width, length]` (in mm) to
 * classify whether a mesh is:
 *  - `'flat_board'`: Valid sheet-good panel (`thickness <= 25 mm`, `width >= 80 mm`,
 *    `length >= 100 mm`, surface area `>= 15,000 mm²`)
 *  - `'compound_carcass'`: Multi-board enclosure (`dx > 50 && dy > 50 && dz > 50`
 *    with major structural surface dimensions)
 *  - `'hardware_or_foot'`: Small block, cabinet foot/leg, hinge, handle, or
 *    sub-threshold component
 */
export function evaluateMeshGeometryKind(dx, dy, dz) {
  const [thickness, width, length] = [dx, dy, dz].sort((a, b) => a - b)
  const surfaceAreaMm2 = width * length

  // 1. Sub-threshold components, cabinet feet, legs, or small hardware blocks
  if (
    width < MIN_SHEET_WIDTH_MM ||
    length < MIN_SHEET_LENGTH_MM ||
    surfaceAreaMm2 < MIN_PANEL_SURFACE_AREA_MM2
  ) {
    return {
      kind: 'hardware_or_foot',
      thickness,
      width,
      length,
      surfaceAreaMm2,
    }
  }

  // 2. Already a flat planar board (smallest dimension <= 25 mm) -> DO NOT decompose
  if (thickness <= MAX_BOARD_THICKNESS_MM) {
    return {
      kind: 'flat_board',
      thickness: Math.max(MIN_BOARD_THICKNESS_MM, Math.round(thickness)),
      width: Math.round(width),
      length: Math.round(length),
      surfaceAreaMm2,
    }
  }

  // 3. Blocky foot/support leg where all extents are <= 140 mm
  if (dx <= 140 && dy <= 140 && dz <= 140) {
    return {
      kind: 'hardware_or_foot',
      thickness,
      width,
      length,
      surfaceAreaMm2,
    }
  }

  // 4. Multi-board carcass enclosure where ALL three bounding box extents exceed 50 mm
  if (
    dx > COMPOUND_CARCASS_MIN_EXTENT_MM &&
    dy > COMPOUND_CARCASS_MIN_EXTENT_MM &&
    dz > COMPOUND_CARCASS_MIN_EXTENT_MM &&
    surfaceAreaMm2 >= MIN_PANEL_SURFACE_AREA_MM2
  ) {
    return {
      kind: 'compound_carcass',
      thickness,
      width,
      length,
      surfaceAreaMm2,
    }
  }

  return {
    kind: 'hardware_or_foot',
    thickness,
    width,
    length,
    surfaceAreaMm2,
  }
}

/**
 * Splits a single merged BufferGeometry into separate BufferGeometries if it
 * contains multiple disconnected 3D vertex islands.
 */
function splitDisconnectedGeometryIslands(geometry, minMaxExtent = 5) {
  if (!geometry || !geometry.attributes?.position) return [geometry]

  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  const posAttr = nonIndexed.attributes.position
  const vertexCount = posAttr.count
  const triCount = Math.floor(vertexCount / 3)

  if (triCount < 2 || triCount > 30000) return [geometry]

  const parent = new Int32Array(triCount)
  for (let i = 0; i < triCount; i++) parent[i] = i

  const find = (i) => {
    let root = i
    while (parent[root] !== root) root = parent[root]
    let curr = i
    while (curr !== root) {
      const nxt = parent[curr]
      parent[curr] = root
      curr = nxt
    }
    return root
  }

  const union = (a, b) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  const vertexToTriMap = new Map()
  for (let t = 0; t < triCount; t++) {
    for (let v = 0; v < 3; v++) {
      const idx = t * 3 + v
      const x = Math.round(posAttr.getX(idx) * 10)
      const y = Math.round(posAttr.getY(idx) * 10)
      const z = Math.round(posAttr.getZ(idx) * 10)
      const key = `${x},${y},${z}`
      const existingTri = vertexToTriMap.get(key)
      if (existingTri !== undefined) {
        union(t, existingTri)
      } else {
        vertexToTriMap.set(key, t)
      }
    }
  }

  const groups = new Map()
  for (let t = 0; t < triCount; t++) {
    const root = find(t)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(t)
  }

  if (groups.size <= 1 || groups.size > 128) {
    return [geometry]
  }

  const subGeometries = []
  for (const triIndices of groups.values()) {
    if (triIndices.length < 2) continue
    const positions = new Float32Array(triIndices.length * 9)
    let writeIdx = 0
    for (let i = 0; i < triIndices.length; i++) {
      const baseVertex = triIndices[i] * 3
      for (let v = 0; v < 3; v++) {
        positions[writeIdx++] = posAttr.getX(baseVertex + v)
        positions[writeIdx++] = posAttr.getY(baseVertex + v)
        positions[writeIdx++] = posAttr.getZ(baseVertex + v)
      }
    }
    const subGeo = new THREE.BufferGeometry()
    subGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    subGeo.computeVertexNormals()
    subGeo.computeBoundingBox()
    const bb = subGeo.boundingBox
    if (bb) {
      const sx = bb.max.x - bb.min.x
      const sy = bb.max.y - bb.min.y
      const sz = bb.max.z - bb.min.z
      if (Math.max(sx, sy, sz) >= minMaxExtent) {
        subGeometries.push(subGeo)
      }
    }
  }

  return subGeometries.length > 1 ? subGeometries : [geometry]
}

/**
 * Computes 2D rectangle overlap ratio relative to the smaller rectangle's area.
 */
function compute2DOverlapRatio(a, b, margin = 0) {
  const overlapU = Math.max(
    0,
    Math.min(a.uMax + margin, b.uMax + margin) -
      Math.max(a.uMin - margin, b.uMin - margin)
  )
  const overlapV = Math.max(
    0,
    Math.min(a.vMax + margin, b.vMax + margin) -
      Math.max(a.vMin - margin, b.vMin - margin)
  )
  const overlapArea = overlapU * overlapV
  if (overlapArea <= 0) return 0
  const areaA = Math.max(1, (a.uMax - a.uMin) * (a.vMax - a.vMin))
  const areaB = Math.max(1, (b.uMax - b.uMin) * (b.vMax - b.vMin))
  return overlapArea / Math.min(areaA, areaB)
}

/**
 * Decomposes a multi-board compound carcass mesh (`dx > 50 && dy > 50 && dz > 50`)
 * by clustering faces according to their orthogonal normals (±Y, ±X, ±Z),
 * pairing opposing parallel faces separated by board thickness (`<= 25 mm`),
 * and extracting any sub-base cabinet feet protruding below the bottom panel.
 */
export function decomposeCompoundGeometry(geometry, parentWorldBox, defaultThickness = 18) {
  if (!geometry || !geometry.attributes?.position) {
    return { boards: [], hardware: [] }
  }

  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  const posAttr = nonIndexed.attributes.position
  const triCount = Math.floor(posAttr.count / 3)
  if (triCount < 2) {
    return { boards: [], hardware: [] }
  }

  const buckets = {
    X: [], // Lateral vertical faces (normal ~ ±X), plane coord = x, (u, v) = (y, z)
    Y: [], // Horizontal faces (normal ~ ±Y), plane coord = y, (u, v) = (x, z)
    Z: [], // Depth vertical faces (normal ~ ±Z), plane coord = z, (u, v) = (x, y)
  }

  const allTriRecords = []
  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3
    vA.set(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0))
    vB.set(posAttr.getX(i0 + 1), posAttr.getY(i0 + 1), posAttr.getZ(i0 + 1))
    vC.set(posAttr.getX(i0 + 2), posAttr.getY(i0 + 2), posAttr.getZ(i0 + 2))

    e1.subVectors(vB, vA)
    e2.subVectors(vC, vA)
    normal.crossVectors(e1, e2)
    const doubleArea = normal.length()
    if (doubleArea < 2.0) continue
    normal.divideScalar(doubleArea)

    const xMin = Math.min(vA.x, vB.x, vC.x)
    const xMax = Math.max(vA.x, vB.x, vC.x)
    const yMin = Math.min(vA.y, vB.y, vC.y)
    const yMax = Math.max(vA.y, vB.y, vC.y)
    const zMin = Math.min(vA.z, vB.z, vC.z)
    const zMax = Math.max(vA.z, vB.z, vC.z)
    const cy = (vA.y + vB.y + vC.y) / 3

    allTriRecords.push({ t, cy, yMin, yMax })

    const ax = Math.abs(normal.x)
    const ay = Math.abs(normal.y)
    const az = Math.abs(normal.z)

    // Filter out thin board-edge rim strips (<= 29 mm wide) so 18mm edges of
    // perpendicular boards never stretch a panel's bounding box across open cubbies.
    const edgeStripLimit = MAX_BOARD_THICKNESS_MM + 4.0

    if (ay >= ax && ay >= az) {
      const uSpan = xMax - xMin
      const vSpan = zMax - zMin
      if (Math.min(uSpan, vSpan) <= edgeStripLimit) continue
      buckets.Y.push({
        p: cy,
        pMin: yMin,
        pMax: yMax,
        uMin: xMin,
        uMax: xMax,
        vMin: zMin,
        vMax: zMax,
        area: doubleArea * 0.5,
      })
    } else if (ax >= ay && ax >= az) {
      const uSpan = yMax - yMin
      const vSpan = zMax - zMin
      if (Math.min(uSpan, vSpan) <= edgeStripLimit) continue
      buckets.X.push({
        p: (vA.x + vB.x + vC.x) / 3,
        pMin: xMin,
        pMax: xMax,
        uMin: yMin,
        uMax: yMax,
        vMin: zMin,
        vMax: zMax,
        area: doubleArea * 0.5,
      })
    } else {
      const uSpan = xMax - xMin
      const vSpan = yMax - yMin
      if (Math.min(uSpan, vSpan) <= edgeStripLimit) continue
      buckets.Z.push({
        p: (vA.z + vB.z + vC.z) / 3,
        pMin: zMin,
        pMax: zMax,
        uMin: xMin,
        uMax: xMax,
        vMin: yMin,
        vMax: yMax,
        area: doubleArea * 0.5,
      })
    }
  }

  const extractedBoards = []

  for (const axis of ['Y', 'X', 'Z']) {
    const tris = buckets[axis]
    if (tris.length === 0) continue

    // 1. Cluster coplanar triangles on the same plane (within 3.0 mm)
    const nTris = tris.length
    const parent = new Int32Array(nTris)
    for (let i = 0; i < nTris; i++) parent[i] = i

    const find = (i) => {
      let r = i
      while (parent[r] !== r) r = parent[r]
      let c = i
      while (c !== r) {
        const nxt = parent[c]
        parent[c] = r
        c = nxt
      }
      return r
    }

    for (let i = 0; i < nTris; i++) {
      const ti = tris[i]
      for (let j = i + 1; j < nTris; j++) {
        const tj = tris[j]
        if (Math.abs(ti.p - tj.p) > 3.0) continue
        const touchU =
          Math.min(ti.uMax + 2.0, tj.uMax + 2.0) >=
          Math.max(ti.uMin - 2.0, tj.uMin - 2.0)
        const touchV =
          Math.min(ti.vMax + 2.0, tj.vMax + 2.0) >=
          Math.max(ti.vMin - 2.0, tj.vMin - 2.0)
        if (touchU && touchV) {
          const ri = find(i)
          const rj = find(j)
          if (ri !== rj) parent[rj] = ri
        }
      }
    }

    const patchMap = new Map()
    for (let i = 0; i < nTris; i++) {
      const r = find(i)
      const t = tris[i]
      if (!patchMap.has(r)) {
        patchMap.set(r, {
          pSum: t.p * t.area,
          area: t.area,
          pMin: t.pMin,
          pMax: t.pMax,
          uMin: t.uMin,
          uMax: t.uMax,
          vMin: t.vMin,
          vMax: t.vMax,
        })
      } else {
        const g = patchMap.get(r)
        g.pSum += t.p * t.area
        g.area += t.area
        g.pMin = Math.min(g.pMin, t.pMin)
        g.pMax = Math.max(g.pMax, t.pMax)
        g.uMin = Math.min(g.uMin, t.uMin)
        g.uMax = Math.max(g.uMax, t.uMax)
        g.vMin = Math.min(g.vMin, t.vMin)
        g.vMax = Math.max(g.vMax, t.vMax)
      }
    }

    // 2. Keep only major coplanar face groups meeting shop-floor thresholds:
    //    - `min(du, dv) >= 80 mm` and `max(du, dv) >= 100 mm`
    //    - `area >= 15,000 mm²` (`0.015 m²`)
    //    - Solid fill ratio `>= 0.55` (rejects open U-shaped perimeter rim frames)
    const broadPatches = []
    for (const g of patchMap.values()) {
      const du = g.uMax - g.uMin
      const dv = g.vMax - g.vMin
      const minSpan = Math.min(du, dv)
      const maxSpan = Math.max(du, dv)
      const bboxArea = Math.max(1, du * dv)
      const fillRatio = g.area / bboxArea

      if (
        minSpan >= MIN_SHEET_WIDTH_MM &&
        maxSpan >= MIN_SHEET_LENGTH_MM &&
        g.area >= MIN_PANEL_SURFACE_AREA_MM2 &&
        fillRatio >= 0.55
      ) {
        broadPatches.push({
          ...g,
          p: g.pSum / Math.max(1e-5, g.area),
          du,
          dv,
        })
      }
    }

    if (broadPatches.length === 0) continue

    // 3. Opposing Face Pairing: pair opposing parallel face clusters separated by
    //    board thickness (`<= 25 mm`) into a single volumetric panel
    const m = broadPatches.length
    const pParent = new Int32Array(m)
    for (let i = 0; i < m; i++) pParent[i] = i
    const findPatch = (i) => {
      let r = i
      while (pParent[r] !== r) r = pParent[r]
      return r
    }

    for (let i = 0; i < m; i++) {
      const pi = broadPatches[i]
      for (let j = i + 1; j < m; j++) {
        const pj = broadPatches[j]
        const dp = Math.abs(pi.p - pj.p)
        if (dp > MAX_BOARD_THICKNESS_MM) continue

        // Only pair opposing faces if their planar dimensions (du, dv) also correspond
        // to the same panel (within 2x board thickness for rabbet/dado joints).
        const diffU = Math.abs(pi.du - pj.du)
        const diffV = Math.abs(pi.dv - pj.dv)
        if (diffU > MAX_BOARD_THICKNESS_MM * 2.2 || diffV > MAX_BOARD_THICKNESS_MM * 2.2) {
          continue
        }

        const overlapRatio = compute2DOverlapRatio(pi, pj, 12.0)
        if (overlapRatio > 0.5 || (dp <= 3.5 && overlapRatio > 0.25)) {
          const ri = findPatch(i)
          const rj = findPatch(j)
          if (ri !== rj) pParent[rj] = ri
        }
      }
    }

    const boardMap = new Map()
    for (let i = 0; i < m; i++) {
      const r = findPatch(i)
      const p = broadPatches[i]
      if (!boardMap.has(r)) {
        boardMap.set(r, {
          pMin: p.pMin,
          pMax: p.pMax,
          uMin: p.uMin,
          uMax: p.uMax,
          vMin: p.vMin,
          vMax: p.vMax,
        })
      } else {
        const b = boardMap.get(r)
        b.pMin = Math.min(b.pMin, p.pMin)
        b.pMax = Math.max(b.pMax, p.pMax)
        b.uMin = Math.min(b.uMin, p.uMin)
        b.uMax = Math.max(b.uMax, p.uMax)
        b.vMin = Math.min(b.vMin, p.vMin)
        b.vMax = Math.max(b.vMax, p.vMax)
      }
    }

    // 4. Construct volumetric 3D board geometries
    for (const b of boardMap.values()) {
      const du = b.uMax - b.uMin
      const dv = b.vMax - b.vMin
      const minSpan = Math.min(du, dv)
      const maxSpan = Math.max(du, dv)
      const surfaceArea = du * dv

      if (
        minSpan < MIN_SHEET_WIDTH_MM ||
        maxSpan < MIN_SHEET_LENGTH_MM ||
        surfaceArea < MIN_PANEL_SURFACE_AREA_MM2
      ) {
        continue
      }

      const rawThick = b.pMax - b.pMin
      const thickness =
        rawThick >= MIN_BOARD_THICKNESS_MM && rawThick <= MAX_BOARD_THICKNESS_MM
          ? rawThick
          : defaultThickness

      const pCenter = (b.pMin + b.pMax) * 0.5
      const uCenter = (b.uMin + b.uMax) * 0.5
      const vCenter = (b.vMin + b.vMax) * 0.5

      let sx = 0
      let sy = 0
      let sz = 0
      const pos = new THREE.Vector3()

      if (axis === 'Y') {
        sx = du
        sy = thickness
        sz = dv
        pos.set(uCenter, pCenter, vCenter)
      } else if (axis === 'X') {
        sx = thickness
        sy = du
        sz = dv
        pos.set(pCenter, uCenter, vCenter)
      } else {
        sx = du
        sy = dv
        sz = thickness
        pos.set(uCenter, vCenter, pCenter)
      }

      const boxGeo = new THREE.BoxGeometry(sx, sy, sz)
      boxGeo.computeVertexNormals()
      boxGeo.computeBoundingBox()

      extractedBoards.push({
        geometry: boxGeo,
        position: pos,
        axis,
        pMin: pCenter - thickness * 0.5,
        pMax: pCenter + thickness * 0.5,
        parentBox: parentWorldBox.clone(),
        wasDecomposedFromCompound: true,
      })
    }
  }

  // 5. Check for cabinet feet / legs attached below the lowest horizontal panel of this carcass
  const extractedHardware = []
  const yBoards = extractedBoards.filter((b) => b.axis === 'Y')
  if (yBoards.length > 0) {
    const lowestBoardMinY = Math.min(...yBoards.map((b) => b.pMin))
    if (lowestBoardMinY - parentWorldBox.min.y > 12) {
      const subBaseTriIndices = allTriRecords
        .filter((tr) => tr.cy < lowestBoardMinY - 1.5 && tr.yMax <= lowestBoardMinY + 2.0)
        .map((tr) => tr.t)

      if (subBaseTriIndices.length >= 4) {
        const subPositions = new Float32Array(subBaseTriIndices.length * 9)
        let wIdx = 0
        for (let i = 0; i < subBaseTriIndices.length; i++) {
          const baseV = subBaseTriIndices[i] * 3
          for (let v = 0; v < 3; v++) {
            subPositions[wIdx++] = posAttr.getX(baseV + v)
            subPositions[wIdx++] = posAttr.getY(baseV + v)
            subPositions[wIdx++] = posAttr.getZ(baseV + v)
          }
        }
        const subBaseGeo = new THREE.BufferGeometry()
        subBaseGeo.setAttribute('position', new THREE.BufferAttribute(subPositions, 3))
        const footIslands = splitDisconnectedGeometryIslands(subBaseGeo, 10)
        footIslands.forEach((footGeo) => {
          footGeo.computeBoundingBox()
          const fb = footGeo.boundingBox
          if (!fb) return
          const fSize = new THREE.Vector3()
          const fCenter = new THREE.Vector3()
          fb.getSize(fSize)
          fb.getCenter(fCenter)
          if (Math.max(fSize.x, fSize.y, fSize.z) >= 12 && Math.min(fSize.x, fSize.z) <= 150) {
            footGeo.translate(-fCenter.x, -fCenter.y, -fCenter.z)
            footGeo.computeVertexNormals()
            footGeo.computeBoundingBox()
            extractedHardware.push({
              geometry: footGeo,
              position: fCenter,
            })
          }
        })
      }
    }
  }

  return { boards: extractedBoards, hardware: extractedHardware }
}

/**
 * Spatial Co-Location & Redundant Face Deduplication Filter:
 *  - Redundant Top Face Merging: merges upper cubby top face into outer Top Panel.
 *  - Horizontal Shelf Co-Location (`|Y_center1 - Y_center2| <= 28 mm` and overlapping X/Z spans):
 *    merges duplicate/stacked horizontal faces into a single shelf.
 *  - Vertical Divider / Side Co-Location (`|X_center1 - X_center2| <= 28 mm` and overlapping Y/Z spans):
 *    merges opposite divider faces or flush cubby side walls into a single panel.
 *  - Facing Panel Co-Location (`|Z_center1 - Z_center2| <= 28 mm` and overlapping X/Y spans):
 *    merges duplicate back/front faces into a single panel.
 */
function deduplicateAndMergeRedundantPanels(meshes, assemblyBox) {
  if (!meshes || meshes.length <= 1) return meshes

  const panelInfos = meshes.map((mesh) => {
    mesh.updateWorldMatrix(true, false)
    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const dx = size.x
    const dy = size.y
    const dz = size.z

    let axis = 'Y'
    let area2D = dx * dz
    let pCenter = center.y
    let pMin = box.min.y
    let pMax = box.max.y
    let uMin = box.min.x
    let uMax = box.max.x
    let vMin = box.min.z
    let vMax = box.max.z

    if (dy <= dx && dy <= dz) {
      axis = 'Y'
      area2D = dx * dz
      pCenter = center.y
      pMin = box.min.y
      pMax = box.max.y
      uMin = box.min.x
      uMax = box.max.x
      vMin = box.min.z
      vMax = box.max.z
    } else if (dx <= dy && dx <= dz) {
      axis = 'X'
      area2D = dy * dz
      pCenter = center.x
      pMin = box.min.x
      pMax = box.max.x
      uMin = box.min.y
      uMax = box.max.y
      vMin = box.min.z
      vMax = box.max.z
    } else {
      axis = 'Z'
      area2D = dx * dy
      pCenter = center.z
      pMin = box.min.z
      pMax = box.max.z
      uMin = box.min.x
      uMax = box.max.x
      vMin = box.min.y
      vMax = box.max.y
    }

    return {
      mesh,
      box,
      size,
      center,
      dx,
      dy,
      dz,
      axis,
      area2D,
      pCenter,
      pMin,
      pMax,
      uMin,
      uMax,
      vMin,
      vMax,
      discard: false,
    }
  })

  const assemblyDepth = Math.max(1, assemblyBox.max.z - assemblyBox.min.z)
  const isHorizontalStretcher = (info) =>
    info.axis === 'Y' &&
    (Math.min(info.dx, info.dz) <= 120 ||
      info.dz < 0.35 * assemblyDepth ||
      info.dz < 0.7 * assemblyDepth)

  // 1. REDUNDANT TOP FACE MERGING (CUBBY & TOP PANEL)
  const topCandidates = panelInfos.filter(
    (info) =>
      info.axis === 'Y' &&
      !isHorizontalStretcher(info) &&
      (Math.abs(info.box.max.y - assemblyBox.max.y) <= 28 ||
        (info.mesh.userData?.parentCompoundBox &&
          Math.abs(info.mesh.userData.parentCompoundBox.max.y - assemblyBox.max.y) <= 28 &&
          Math.abs(info.box.max.y - info.mesh.userData.parentCompoundBox.max.y) <= 25))
  )

  if (topCandidates.length > 1) {
    topCandidates.sort((a, b) => b.area2D - a.area2D)
    const primaryTop = topCandidates[0]

    for (let i = 1; i < topCandidates.length; i++) {
      const candidate = topCandidates[i]
      const distToAssemblyTop = Math.abs(candidate.box.max.y - assemblyBox.max.y)
      const distToPrimaryBottom = Math.abs(candidate.box.max.y - primaryTop.box.min.y)
      const distBetweenCenters = Math.abs(candidate.center.y - primaryTop.center.y)
      const verticalGap = Math.min(
        distToAssemblyTop,
        distToPrimaryBottom,
        distBetweenCenters
      )
      const overlap = compute2DOverlapRatio(primaryTop, candidate, 8)
      if (verticalGap <= 28 && overlap > 0.25) {
        candidate.discard = true
      }
    }
  }

  // 2. SPATIAL CO-LOCATION DEDUPLICATION FILTER (Horizontal Shelves, Vertical Dividers/Sides, Back/Front)
  //    Sort descending by 2D surface area so the full-span primary board absorbs smaller co-located faces
  const sortedByArea = [...panelInfos].sort((a, b) => b.area2D - a.area2D)

  for (let i = 0; i < sortedByArea.length; i++) {
    const primary = sortedByArea[i]
    if (primary.discard) continue

    for (let j = i + 1; j < sortedByArea.length; j++) {
      const secondary = sortedByArea[j]
      if (secondary.discard || primary.axis !== secondary.axis) continue

      // Never absorb a narrow Top Stretcher / Cabinet Rail into a full-depth Top Panel or Shelf
      if (
        primary.axis === 'Y' &&
        isHorizontalStretcher(primary) !== isHorizontalStretcher(secondary)
      ) {
        continue
      }

      const centerDist = Math.abs(primary.pCenter - secondary.pCenter)

      // Co-located if center separation <= 25 mm and 2D spans overlap
      if (centerDist <= 25) {
        const overlap = compute2DOverlapRatio(primary, secondary, 8)
        if (overlap > 0.35) {
          // If merging two single-sided or offset faces of the same board (e.g. lower carcass shelf face
          // and upper cubby floor face), align the surviving primary board to the combined mid-plane
          // so no vertical gap is created beneath the upper vertical divider.
          if (centerDist > 1.0 && centerDist <= 22.0) {
            const combinedMid = (primary.pCenter + secondary.pCenter) * 0.5
            if (primary.axis === 'Y') {
              primary.mesh.position.y = combinedMid
            } else if (primary.axis === 'X') {
              primary.mesh.position.x = combinedMid
            } else if (primary.axis === 'Z') {
              primary.mesh.position.z = combinedMid
            }
            primary.mesh.updateWorldMatrix(true, false)
            primary.box.setFromObject(primary.mesh)
            primary.box.getCenter(primary.center)
            primary.pCenter = combinedMid
            primary.pMin =
              primary.axis === 'Y'
                ? primary.box.min.y
                : primary.axis === 'X'
                ? primary.box.min.x
                : primary.box.min.z
            primary.pMax =
              primary.axis === 'Y'
                ? primary.box.max.y
                : primary.axis === 'X'
                ? primary.box.max.x
                : primary.box.max.z
          }
          secondary.discard = true
        }
      }
    }
  }

  // 3. ENSURE FLUSH VERTICAL CONTACT BETWEEN INTERIOR DIVIDERS AND SUPPORTING SHELVES / TOP PANEL
  //    Eliminates any floating vertical gap between the bottom of an upper vertical divider
  //    and the top surface of the horizontal shelf supporting it.
  const activeHorizontals = panelInfos.filter(
    (info) => !info.discard && info.axis === 'Y'
  )
  const assemblyHeight = Math.max(1, assemblyBox.max.y - assemblyBox.min.y)

  panelInfos.forEach((divInfo) => {
    if (divInfo.discard || divInfo.axis !== 'X') return
    // Only adjust interior vertical dividers (not full-height outer left/right gables)
    const isOuterSide =
      divInfo.dy >= assemblyHeight * 0.85 &&
      (Math.abs(divInfo.box.min.x - assemblyBox.min.x) <= 15 ||
        Math.abs(divInfo.box.max.x - assemblyBox.max.x) <= 15)
    if (isOuterSide) return

    let targetMinY = divInfo.box.min.y
    let targetMaxY = divInfo.box.max.y
    let bestBelowGap = 32
    let bestAboveGap = 32

    activeHorizontals.forEach((hInfo) => {
      // Check horizontal X and Z span overlap with the vertical divider
      const xCovers =
        divInfo.center.x >= hInfo.box.min.x - 20 &&
        divInfo.center.x <= hInfo.box.max.x + 20
      const zOverlap =
        Math.min(divInfo.box.max.z, hInfo.box.max.z) -
        Math.max(divInfo.box.min.z, hInfo.box.min.z)
      if (!xCovers || zOverlap <= 20) return

      // Supporting shelf below the divider
      if (hInfo.center.y < divInfo.center.y) {
        const gapBelow = Math.abs(divInfo.box.min.y - hInfo.box.max.y)
        if (gapBelow > 0.1 && gapBelow <= bestBelowGap) {
          bestBelowGap = gapBelow
          targetMinY = hInfo.box.max.y
        }
      }
      // Top panel or upper shelf above the divider
      else if (hInfo.center.y > divInfo.center.y) {
        const gapAbove = Math.abs(hInfo.box.min.y - divInfo.box.max.y)
        if (gapAbove > 0.1 && gapAbove <= bestAboveGap) {
          bestAboveGap = gapAbove
          targetMaxY = hInfo.box.min.y
        }
      }
    })

    const newHeight = targetMaxY - targetMinY
    if (
      newHeight >= MIN_SHEET_WIDTH_MM &&
      (Math.abs(targetMinY - divInfo.box.min.y) > 0.1 ||
        Math.abs(targetMaxY - divInfo.box.max.y) > 0.1)
    ) {
      const newCenterY = (targetMinY + targetMaxY) * 0.5
      const newGeo = new THREE.BoxGeometry(divInfo.dx, newHeight, divInfo.dz)
      newGeo.computeVertexNormals()
      newGeo.computeBoundingBox()
      divInfo.mesh.geometry?.dispose()
      divInfo.mesh.geometry = newGeo
      divInfo.mesh.position.y = newCenterY
      divInfo.mesh.updateWorldMatrix(true, false)
      divInfo.box.setFromObject(divInfo.mesh)
      divInfo.dy = newHeight
    }
  })

  const retainedMeshes = []
  panelInfos.forEach((info) => {
    if (info.discard) {
      info.mesh.parent?.remove(info.mesh)
      info.mesh.geometry?.dispose()
    } else {
      retainedMeshes.push(info.mesh)
    }
  })

  return retainedMeshes
}

/**
 * Normalizes an uploaded 3D model (.dae or .obj) into centered millimeter (mm)
 * Y-up world coordinates, preserves all cabinet feet/hardware in the 3D scene
 * while segregating them from sheet-good panels, preserves volumetric solid boards,
 * and deduplicates co-located shelves/dividers.
 */
export function normalizeLoadedCabinetModel(loadedModel) {
  if (!loadedModel) return { meshes: [], hardwareMeshes: [], scaleToMm: 1 }

  // 1. Strip stray non-outline CAD construction lines
  const strayLines = []
  loadedModel.traverse((child) => {
    if ((child.isLine || child.isLineSegments) && !child.userData?.isEdgeOutline) {
      strayLines.push(child)
    }
  })
  strayLines.forEach((ln) => ln.parent?.remove(ln))

  // 2. Measure initial world bounds to detect unit scale (meters / inches / mm)
  loadedModel.updateMatrixWorld(true)
  const initialBox = new THREE.Box3().setFromObject(loadedModel)
  const initialSize = initialBox.getSize(new THREE.Vector3())
  const initialCenter = initialBox.getCenter(new THREE.Vector3())

  const maxOverall = Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001)
  const scaleToMm = maxOverall < 10 ? 1000 : maxOverall < 100 ? 25.4 : 1

  const rawMeshes = []
  loadedModel.traverse((child) => {
    if (child.isMesh && child.geometry) {
      rawMeshes.push(child)
    }
  })

  if (rawMeshes.length === 0) {
    return { meshes: [], hardwareMeshes: [], scaleToMm }
  }

  const centerTransform = new THREE.Matrix4().makeTranslation(
    -initialCenter.x,
    -initialCenter.y,
    -initialCenter.z
  )
  const scaleTransform = new THREE.Matrix4().makeScale(
    scaleToMm,
    scaleToMm,
    scaleToMm
  )
  const worldToCenteredMm = new THREE.Matrix4().multiplyMatrices(
    scaleTransform,
    centerTransform
  )

  const preparedMeshes = []
  rawMeshes.forEach((mesh) => {
    const bakedMatrix = new THREE.Matrix4().multiplyMatrices(
      worldToCenteredMm,
      mesh.matrixWorld
    )
    const clonedGeo = mesh.geometry.clone()
    clonedGeo.applyMatrix4(bakedMatrix)
    clonedGeo.computeBoundingBox()

    const rawName = mesh.name || mesh.parent?.name || ''
    preparedMeshes.push({ geometry: clonedGeo, rawName })
  })

  // Rebuild clean mesh children directly under `loadedModel`
  while (loadedModel.children.length > 0) {
    loadedModel.remove(loadedModel.children[0])
  }
  loadedModel.position.set(0, 0, 0)
  loadedModel.rotation.set(0, 0, 0)
  loadedModel.scale.set(1, 1, 1)
  loadedModel.updateMatrixWorld(true)

  const candidatePanelMeshes = []
  const hardwareMeshes = []

  const addHardwareIslandMesh = (hwGeo, rawName) => {
    hwGeo.computeBoundingBox()
    const hb = hwGeo.boundingBox
    if (!hb) return
    const hSize = new THREE.Vector3()
    hb.getSize(hSize)
    if (Math.max(hSize.x, hSize.y, hSize.z) < 10) return // ignore tiny stray dust < 10mm
    const geomCenter = new THREE.Vector3()
    hb.getCenter(geomCenter)
    hwGeo.translate(-geomCenter.x, -geomCenter.y, -geomCenter.z)
    hwGeo.computeVertexNormals()
    hwGeo.computeBoundingBox()

    const hwMesh = new THREE.Mesh(hwGeo)
    hwMesh.position.copy(geomCenter)
    hwMesh.name = 'Cabinet Foot / Leg'
    hwMesh.userData = {
      rawOriginalName: rawName,
      isHardware: true,
      type: 'hardware',
      category: 'footing',
      panelRole: 'Cabinet Foot / Leg',
      partName: 'Cabinet Foot / Leg',
      dimensionsMm: { dx: hSize.x, dy: hSize.y, dz: hSize.z },
    }
    loadedModel.add(hwMesh)
    hardwareMeshes.push(hwMesh)
  }

  // 3. Evaluate each mesh dynamically
  preparedMeshes.forEach(({ geometry, rawName }) => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return
    const size = new THREE.Vector3()
    box.getSize(size)

    const evalResult = evaluateMeshGeometryKind(size.x, size.y, size.z)

    // Preserve Hardware & Footing meshes in the 3D scene while segregating from sheet cutlist
    if (evalResult.kind === 'hardware_or_foot') {
      const islands = splitDisconnectedGeometryIslands(geometry, 10)
      islands.forEach((islGeo) => addHardwareIslandMesh(islGeo, rawName))
      return
    }

    // Conditional Decomposition: Only decompose when dx > 50 && dy > 50 && dz > 50
    if (evalResult.kind === 'compound_carcass') {
      const { boards, hardware } = decomposeCompoundGeometry(geometry, box, 18)
      if (boards.length === 0 && hardware.length === 0) {
        // Multi-foot hardware group with no large sheet panels: split into individual foot islands
        const islands = splitDisconnectedGeometryIslands(geometry, 10)
        islands.forEach((islGeo) => {
          islGeo.computeBoundingBox()
          const ib = islGeo.boundingBox
          if (!ib) return
          const iSize = new THREE.Vector3()
          ib.getSize(iSize)
          const iEval = evaluateMeshGeometryKind(iSize.x, iSize.y, iSize.z)
          if (iEval.kind === 'hardware_or_foot') {
            addHardwareIslandMesh(islGeo, rawName)
          }
        })
        return
      }

      boards.forEach((board) => {
        const panelMesh = new THREE.Mesh(board.geometry)
        panelMesh.position.copy(board.position)
        panelMesh.name = rawName
        panelMesh.userData = {
          rawOriginalName: rawName,
          parentCompoundBox: board.parentBox,
          wasDecomposed: true,
          isHardware: false,
        }
        loadedModel.add(panelMesh)
        candidatePanelMeshes.push(panelMesh)
      })
      hardware.forEach((hw) => {
        hw.geometry.computeBoundingBox()
        const hwSize = new THREE.Vector3()
        hw.geometry.boundingBox.getSize(hwSize)
        const hwMesh = new THREE.Mesh(hw.geometry)
        hwMesh.position.copy(hw.position)
        hwMesh.name = 'Cabinet Foot / Leg'
        hwMesh.userData = {
          rawOriginalName: rawName,
          isHardware: true,
          type: 'hardware',
          category: 'footing',
          panelRole: 'Cabinet Foot / Leg',
          partName: 'Cabinet Foot / Leg',
          dimensionsMm: { dx: hwSize.x, dy: hwSize.y, dz: hwSize.z },
        }
        loadedModel.add(hwMesh)
        hardwareMeshes.push(hwMesh)
      })
      return
    }

    // Discrete flat planar board (`thickness <= 25 mm`, `width >= 80 mm`, `length >= 100 mm`):
    // Treat as ONE single panel without splitting or decomposing its faces.
    const geomCenter = new THREE.Vector3()
    box.getCenter(geomCenter)

    let finalGeometry = geometry
    if (evalResult.thickness < MIN_BOARD_THICKNESS_MM) {
      // Single-sided 2D CAD surface plane: give it standard 18mm volumetric board thickness
      const sx = size.x < MIN_BOARD_THICKNESS_MM ? 18 : size.x
      const sy = size.y < MIN_BOARD_THICKNESS_MM ? 18 : size.y
      const sz = size.z < MIN_BOARD_THICKNESS_MM ? 18 : size.z
      finalGeometry = new THREE.BoxGeometry(sx, sy, sz)
    } else {
      finalGeometry.translate(-geomCenter.x, -geomCenter.y, -geomCenter.z)
    }
    finalGeometry.computeVertexNormals()
    finalGeometry.computeBoundingBox()

    const mesh = new THREE.Mesh(finalGeometry)
    mesh.position.copy(geomCenter)
    mesh.name = rawName
    mesh.userData = {
      rawOriginalName: rawName,
      wasDecomposed: false,
      isHardware: false,
    }
    loadedModel.add(mesh)
    candidatePanelMeshes.push(mesh)
  })

  loadedModel.updateMatrixWorld(true)

  // Compute structural carcass bounding box from sheet-good panels (excluding feet)
  const structuralBox = new THREE.Box3()
  candidatePanelMeshes.forEach((m) => {
    m.updateWorldMatrix(true, false)
    structuralBox.union(new THREE.Box3().setFromObject(m))
  })
  if (structuralBox.isEmpty()) {
    structuralBox.setFromObject(loadedModel)
  }

  // 4. Spatial Co-Location & Redundant Face Deduplication
  const deduplicatedMeshes = deduplicateAndMergeRedundantPanels(
    candidatePanelMeshes,
    structuralBox
  )

  loadedModel.updateMatrixWorld(true)
  return { meshes: deduplicatedMeshes, hardwareMeshes, scaleToMm }
}

/**
 * Performs automatic panel role classification for all structural sheet panels
 * and configures hardware/footing metadata & explosion kinematics.
 */
export function classifyCabinetPanels(loadedModel, options = {}) {
  if (!loadedModel) {
    return { assemblyBox: new THREE.Box3(), panels: [], hardware: [] }
  }

  const preserveExplicitName = Boolean(options.preserveExplicitName)
  loadedModel.updateMatrixWorld(true)

  // Compute structural assembly box from non-hardware sheet panels so bottom feet do not skew Bottom Panel height
  const structuralBox = new THREE.Box3()
  const sheetMeshes = []
  const hwMeshes = []

  loadedModel.traverse((child) => {
    if (!child.isMesh || !child.geometry) return
    child.updateWorldMatrix(true, false)
    if (child.userData?.isHardware) {
      hwMeshes.push(child)
    } else {
      sheetMeshes.push(child)
      structuralBox.union(new THREE.Box3().setFromObject(child))
    }
  })

  const assemblyBox = structuralBox.isEmpty()
    ? new THREE.Box3().setFromObject(loadedModel)
    : structuralBox
  const assemblyCenter = assemblyBox.getCenter(new THREE.Vector3())
  const assemblySize = assemblyBox.getSize(new THREE.Vector3())
  const assemblyHeight = assemblySize.y

  const maxAssemblyDim = Math.max(assemblySize.x, assemblySize.y, assemblySize.z, 1)
  const scaleFactor = maxAssemblyDim < 10 ? 1000 : maxAssemblyDim < 100 ? 25.4 : 1
  const tolerance = (options.tolerance ?? 10) / scaleFactor

  const panelRecords = []
  const shelfRecords = []
  const dividerRecords = []

  let panelIdx = 0
  sheetMeshes.forEach((child) => {
    const panelBox = new THREE.Box3().setFromObject(child)
    const panelCenter = panelBox.getCenter(new THREE.Vector3())

    const dx = panelBox.max.x - panelBox.min.x
    const dy = panelBox.max.y - panelBox.min.y
    const dz = panelBox.max.z - panelBox.min.z

    let role = 'Shelf'
    let axisType = 'horizontal' // 'horizontal' | 'vertical' | 'facing'

    // 1. Horizontal panel (Y is thin axis)
    if (dy <= dx && dy <= dz) {
      axisType = 'horizontal'
      // Stretcher Aspect Ratio Rule:
      // Compare horizontal panel width/depth (W) to total cabinet assembly depth (D_assembly).
      // If W <= 120 mm (or W < 0.35 * D_assembly), classify strictly as "Top Stretcher" (or "Cabinet Rail").
      // Only classify as "Top Panel" or "Shelf" if W >= 0.70 * D_assembly (covers main carcass depth).
      const minPlanarW = Math.min(dx, dz)
      const assemblyDepth = Math.max(1, assemblySize.z)
      const isNarrowStretcher =
        minPlanarW <= 120 / scaleFactor ||
        dz < 0.35 * assemblyDepth ||
        dz < 0.7 * assemblyDepth

      if (isNarrowStretcher) {
        role =
          panelCenter.y >= assemblyCenter.y ? 'Top Stretcher' : 'Cabinet Rail'
      } else if (panelBox.max.y >= assemblyBox.max.y - tolerance) {
        role = 'Top Panel'
      } else if (
        panelBox.min.y <=
        assemblyBox.min.y + Math.max(tolerance, assemblyHeight * 0.2)
      ) {
        role = 'Bottom Panel'
      } else {
        role = 'Shelf'
      }
    }
    // 2. Vertical side panel / divider (X is thin axis)
    else if (dx <= dy && dx <= dz) {
      axisType = 'vertical'
      const isFullHeightSide = dy >= assemblyHeight * 0.55
      if (panelBox.min.x <= assemblyBox.min.x + tolerance && isFullHeightSide) {
        role = 'Left Side Panel'
      } else if (
        panelBox.max.x >= assemblyBox.max.x - tolerance &&
        isFullHeightSide
      ) {
        role = 'Right Side Panel'
      } else {
        role = 'Vertical Divider'
      }
    }
    // 3. Facing panel (Z is thin axis)
    else if (dz <= dx && dz <= dy) {
      axisType = 'facing'
      if (panelBox.min.z <= assemblyBox.min.z + tolerance) {
        role = 'Back Panel'
      } else if (panelBox.max.z >= assemblyBox.max.z - tolerance) {
        role = 'Front Face / Door'
      } else {
        role =
          panelCenter.z < assemblyCenter.z ? 'Back Panel' : 'Front Face / Door'
      }
    }

    // Dynamic Explosion Kinematics: compute outward trajectory individually from
    // each panel's centroid relative to `assemblyCenter`
    const dir = panelCenter.clone().sub(assemblyCenter)
    const explodeDir = new THREE.Vector3()

    if (axisType === 'horizontal') {
      if (role === 'Top Panel') {
        explodeDir.set(0, 1, 0)
      } else if (role === 'Top Stretcher') {
        explodeDir.set(0, 0.85, dir.z >= 0 ? 0.35 : -0.35)
      } else if (role === 'Cabinet Rail') {
        explodeDir.set(0, -0.85, dir.z >= 0 ? 0.35 : -0.35)
      } else if (role === 'Bottom Panel') {
        explodeDir.set(0, -1, 0)
      } else {
        // Interior shelf: displace moderately along ±Y so it separates cleanly from Top and Bottom panels
        explodeDir.set(0, dir.y >= 0 ? 0.45 : -0.45, 0)
      }
    } else if (axisType === 'vertical') {
      if (role === 'Left Side Panel') {
        explodeDir.set(-1, 0, 0)
      } else if (role === 'Right Side Panel') {
        explodeDir.set(1, 0, 0)
      } else {
        // Central / interior vertical divider: displace upward/outward cleanly so it separates from Top & Shelf
        explodeDir.set(Math.abs(dir.x) > 25 ? (dir.x > 0 ? 0.5 : -0.5) : 0, 0.45, 0)
      }
    } else {
      if (role === 'Back Panel') {
        explodeDir.set(0, 0, -1)
      } else if (role === 'Front Face / Door') {
        explodeDir.set(0, 0, 1)
      } else {
        explodeDir.set(0, 0, dir.z >= 0 ? 1 : -1)
      }
    }

    const record = {
      mesh: child,
      panelIndex: panelIdx,
      panelBox,
      panelCenter,
      dx,
      dy,
      dz,
      role,
      axisType,
      explodeDir,
    }

    panelRecords.push(record)
    if (role === 'Shelf') {
      shelfRecords.push(record)
    } else if (role === 'Vertical Divider') {
      dividerRecords.push(record)
    }
    panelIdx += 1
  })

  // Sort shelves by ascending `panelCenter.y` to label sequentially: "Shelf #1", "Shelf #2", ...
  shelfRecords.sort((a, b) => a.panelCenter.y - b.panelCenter.y)
  shelfRecords.forEach((shelfRec, idx) => {
    shelfRec.role = shelfRecords.length === 1 ? 'Shelf #1' : `Shelf #${idx + 1}`
  })

  // Sort vertical dividers by ascending `panelCenter.x`
  dividerRecords.sort((a, b) => a.panelCenter.x - b.panelCenter.x)
  if (dividerRecords.length === 1) {
    dividerRecords[0].role = 'Vertical Divider'
  } else if (dividerRecords.length === 2) {
    dividerRecords[0].role = 'Divider L'
    dividerRecords[0].explodeDir.set(-0.55, 0, 0)
    dividerRecords[1].role = 'Divider R'
    dividerRecords[1].explodeDir.set(0.55, 0, 0)
  } else if (dividerRecords.length > 2) {
    dividerRecords.forEach((divRec, idx) => {
      if (idx === 0) {
        divRec.role = 'Divider L'
        divRec.explodeDir.set(-0.55, 0, 0)
      } else if (idx === dividerRecords.length - 1) {
        divRec.role = 'Divider R'
        divRec.explodeDir.set(0.55, 0, 0)
      } else {
        divRec.role = `Divider #${idx + 1}`
      }
    })
  }

  // Finalize mesh metadata on every structural panel
  panelRecords.forEach((rec) => {
    const { mesh, panelIndex, role, explodeDir, dx, dy, dz } = rec
    const existingCustomName = mesh.userData?.partName || mesh.name || ''
    const finalName =
      preserveExplicitName &&
      existingCustomName &&
      !isAmbiguousCadName(existingCustomName)
        ? existingCustomName
        : role

    rec.role = finalName
    mesh.name = finalName
    mesh.userData = {
      ...mesh.userData,
      isHardware: false,
      meshUuid: mesh.userData?.meshUuid || mesh.uuid,
      panelRole: finalName,
      partName: finalName,
      category:
        finalName.toLowerCase().includes('stretcher')
          ? 'stretcher'
          : finalName.toLowerCase().includes('rail')
          ? 'rail'
          : mesh.userData?.category || finalName.toLowerCase(),
      panelIndex,
      partIndex: panelIndex,
      basePosition: mesh.position.clone(),
      explodeDir: explodeDir.clone(),
      dimensionsMm: { dx, dy, dz },
    }
  })

  // Configure hardware / footing meshes (cabinet feet, legs, brackets)
  const hardwareRecords = hwMeshes.map((hwMesh, hwIdx) => {
    const hwBox = new THREE.Box3().setFromObject(hwMesh)
    const hwCenter = hwBox.getCenter(new THREE.Vector3())
    const dx = hwBox.max.x - hwBox.min.x
    const dy = hwBox.max.y - hwBox.min.y
    const dz = hwBox.max.z - hwBox.min.z
    const explodeDir = new THREE.Vector3(0, -0.85, 0)

    hwMesh.name = 'Cabinet Foot / Leg'
    hwMesh.userData = {
      ...hwMesh.userData,
      isHardware: true,
      type: 'hardware',
      category: 'footing',
      meshUuid: hwMesh.uuid,
      panelRole: 'Cabinet Foot / Leg',
      partName: 'Cabinet Foot / Leg',
      hardwareIndex: hwIdx,
      basePosition: hwMesh.position.clone(),
      explodeDir,
      dimensionsMm: { dx, dy, dz },
    }

    return {
      mesh: hwMesh,
      hardwareIndex: hwIdx,
      box: hwBox,
      center: hwCenter,
      dx,
      dy,
      dz,
      role: 'Cabinet Foot / Leg',
      explodeDir,
    }
  })

  return {
    assemblyBox,
    assemblyCenter,
    assemblySize,
    panels: panelRecords,
    hardware: hardwareRecords,
  }
}
