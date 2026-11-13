import * as THREE from 'three'

/**
 * ============================================================================
 * DYNAMIC 3D PANEL CLASSIFIER, L-SHAPED / STEPPED PANEL DECOMPOSER,
 * OBB DIMENSION EXTRACTOR & STRICT ORNAMENT DETECTOR (`src/utils/panelClassifier.js`)
 * ============================================================================
 * 1. Zero-Thickness Orphan Filter:
 *    - Discards flat 0mm / <2mm orphan end-cap discs and zero-volume meshes before
 *      building the 3D scene and Cutting List.
 * 2. True Unrotated Local / OBB Dimensions:
 *    - Computes part dimensions (L, W, H) from the mesh's local unrotated geometry
 *      bounding box multiplied by world scale + OBB principal-axis alignment so
 *      rotated panels preserve their true board thickness (e.g., 18mm).
 * 3. Non-Rectangular / L-Shaped Back Panel Preservation & Step Decomposition:
 *    - Never replaces a non-rectangular or L-shaped mesh with a solid bounding-box
 *      slab when `actualFaceArea < 0.80 * boxFaceArea`.
 *    - Preserves actual parsed triangle geometry in the 3D viewport so hollow/open
 *      shelving bays stay open, while decomposing L-shaped/stepped panels along their
 *      actual step vertices into constituent rectangular sub-panels for the Cutting List.
 * 4. Strict Panel vs. Ornament Classification & Dynamic Naming:
 *    - Any flat rectilinear board (orthogonal normals, <= 24 triangles, thickness
 *      6mm..25mm) is strictly classified as a standard sheet panel (`isOrnament: false`).
 *    - Only genuinely curved, cylindrical, or complex non-rectilinear meshes
 *      (> 36 triangles with non-orthogonal curved normals) are tagged `isOrnament: true`
 *      and named dynamically ("Cabinet Foot / Leg", "Support Rod / Pole",
 *      "Oval / Curved Panel", or "Ornamental Part").
 */

export const MIN_VALID_THICKNESS_MM = 2.0
export const MIN_BOARD_THICKNESS_MM = 6
export const MAX_BOARD_THICKNESS_MM = 25
export const MIN_SHEET_WIDTH_MM = 40
export const MIN_SHEET_LENGTH_MM = 60
export const MIN_PANEL_SURFACE_AREA_MM2 = 4000
export const COMPOUND_CARCASS_MIN_EXTENT_MM = 50

const AMBIGUOUS_CAD_NAME_PATTERN =
  /^(group[\s_-]*\d*|component[\s_-]*#?\d*|instance[\s_-]*\d*|mesh[\s_-]*\d*|object[\s_-]*\d*|node[\s_-]*\d*|id\d+|sketchup.*|default.*|unnamed.*|panel[\s_-]*#?\d+|cad[\s_-]*model[\s_-]*panel|material[\s_-]*\d*|geom[\s_-]*\d*)$/i

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
 * Computes tight Oriented Bounding Box (OBB) extents `[L, W, H]` (sorted descending)
 * and minimum thickness by testing angular orientations in XY, XZ, and YZ planes
 * alongside the local unrotated bounding box.
 */
export function computeTightOBBDimensions(geometry, localUnrotatedDims = null) {
  if (!geometry || !geometry.attributes?.position) {
    if (localUnrotatedDims) {
      const sorted = [
        localUnrotatedDims.dx,
        localUnrotatedDims.dy,
        localUnrotatedDims.dz,
      ].sort((a, b) => b - a)
      return {
        l: sorted[0],
        w: sorted[1],
        h: sorted[2],
        dx: localUnrotatedDims.dx,
        dy: localUnrotatedDims.dy,
        dz: localUnrotatedDims.dz,
      }
    }
    return { l: 0, w: 0, h: 0, dx: 0, dy: 0, dz: 0 }
  }

  geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  if (!bb) return { l: 0, w: 0, h: 0, dx: 0, dy: 0, dz: 0 }

  let bestDx = bb.max.x - bb.min.x
  let bestDy = bb.max.y - bb.min.y
  let bestDz = bb.max.z - bb.min.z
  let minVolume = Math.max(0.001, bestDx) * Math.max(0.001, bestDy) * Math.max(0.001, bestDz)

  // If unrotated local bounding box from pre-baked transform has a smaller volume/thickness, prefer it
  if (
    localUnrotatedDims &&
    localUnrotatedDims.dx > 0 &&
    localUnrotatedDims.dy > 0 &&
    localUnrotatedDims.dz > 0
  ) {
    const localVol =
      localUnrotatedDims.dx * localUnrotatedDims.dy * localUnrotatedDims.dz
    const localMin = Math.min(
      localUnrotatedDims.dx,
      localUnrotatedDims.dy,
      localUnrotatedDims.dz
    )
    const worldMin = Math.min(bestDx, bestDy, bestDz)
    if (localVol <= minVolume * 1.05 || localMin < worldMin * 0.85) {
      bestDx = localUnrotatedDims.dx
      bestDy = localUnrotatedDims.dy
      bestDz = localUnrotatedDims.dz
      minVolume = localVol
    }
  }

  const posAttr = geometry.attributes.position
  const count = posAttr.count
  if (count >= 3 && count <= 25000) {
    const step = Math.max(1, Math.floor(count / 500))
    const angles = [10, 20, 30, 45, 60, 70, 80]

    // Sweep rotations around Y, X, and Z axes to recover true board thickness of rotated parts
    for (const axis of ['Y', 'Z', 'X']) {
      for (const deg of angles) {
        const rad = (deg * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)

        let minX = Infinity,
          maxX = -Infinity
        let minY = Infinity,
          maxY = -Infinity
        let minZ = Infinity,
          maxZ = -Infinity

        for (let i = 0; i < count; i += step) {
          const x = posAttr.getX(i)
          const y = posAttr.getY(i)
          const z = posAttr.getZ(i)
          let rx = x,
            ry = y,
            rz = z
          if (axis === 'Y') {
            rx = x * cos - z * sin
            rz = x * sin + z * cos
          } else if (axis === 'Z') {
            rx = x * cos - y * sin
            ry = x * sin + y * cos
          } else {
            ry = y * cos - z * sin
            rz = y * sin + z * cos
          }
          if (rx < minX) minX = rx
          if (rx > maxX) maxX = rx
          if (ry < minY) minY = ry
          if (ry > maxY) maxY = ry
          if (rz < minZ) minZ = rz
          if (rz > maxZ) maxZ = rz
        }

        const dx = maxX - minX
        const dy = maxY - minY
        const dz = maxZ - minZ
        const vol = Math.max(0.001, dx) * Math.max(0.001, dy) * Math.max(0.001, dz)
        if (vol < minVolume * 0.96) {
          minVolume = vol
          bestDx = dx
          bestDy = dy
          bestDz = dz
        }
      }
    }
  }

  const sorted = [bestDx, bestDy, bestDz].sort((a, b) => b - a)
  return {
    l: sorted[0],
    w: sorted[1],
    h: sorted[2],
    dx: bestDx,
    dy: bestDy,
    dz: bestDz,
  }
}

/**
 * Inspects a BufferGeometry's triangle count, surface area, normal distribution,
 * and bounding box fill ratio to classify rectilinearity vs. curved ornament status.
 */
export function inspectGeometryCharacteristics(geometry, localUnrotatedDims = null) {
  const obb = computeTightOBBDimensions(geometry, localUnrotatedDims)
  const { l: length, w: width, h: thickness, dx, dy, dz } = obb

  if (!geometry || !geometry.attributes?.position) {
    return {
      ...obb,
      thickness,
      width,
      length,
      triCount: 0,
      nonOrthogonalTriCount: 0,
      distinctNormalBuckets: 0,
      totalArea: 0,
      actualFaceArea: 0,
      boxFaceArea: Math.max(1, width * length),
      faceFillRatio: 1,
      isZeroThickness: true,
      isCurvedOrnament: false,
      isRectilinearBoard: false,
    }
  }

  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry
  const posAttr = nonIndexed.attributes.position
  const rawTriCount = Math.floor(posAttr.count / 3)

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const normal = new THREE.Vector3()

  let validTriCount = 0
  let nonOrthogonalTriCount = 0
  let totalArea = 0
  const axisAreas = { XPos: 0, XNeg: 0, YPos: 0, YNeg: 0, ZPos: 0, ZNeg: 0 }
  const normalSignatures = new Set()

  // Track unique triangle centroids to ignore SketchUp double-sided duplicate faces
  const seenTriCentroids = new Set()

  for (let t = 0; t < rawTriCount; t++) {
    const i0 = t * 3
    vA.set(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0))
    vB.set(posAttr.getX(i0 + 1), posAttr.getY(i0 + 1), posAttr.getZ(i0 + 1))
    vC.set(posAttr.getX(i0 + 2), posAttr.getY(i0 + 2), posAttr.getZ(i0 + 2))

    e1.subVectors(vB, vA)
    e2.subVectors(vC, vA)
    normal.crossVectors(e1, e2)
    const doubleArea = normal.length()
    if (doubleArea < 1.0) continue

    const area = doubleArea * 0.5
    normal.divideScalar(doubleArea)

    const cx = Math.round(((vA.x + vB.x + vC.x) / 3) * 2)
    const cy = Math.round(((vA.y + vB.y + vC.y) / 3) * 2)
    const cz = Math.round(((vA.z + vB.z + vC.z) / 3) * 2)
    const triKey = `${cx},${cy},${cz},${Math.round(area)}`
    const isDuplicateDoubleSide = seenTriCentroids.has(triKey)
    seenTriCentroids.add(triKey)

    if (!isDuplicateDoubleSide) {
      validTriCount += 1
      totalArea += area
    }

    const ax = Math.abs(normal.x)
    const ay = Math.abs(normal.y)
    const az = Math.abs(normal.z)
    const maxAxisComp = Math.max(ax, ay, az)

    // Quantize normal direction up to sign to count distinct surface orientations
    const qnx = Math.round(ax * 5)
    const qny = Math.round(ay * 5)
    const qnz = Math.round(az * 5)
    normalSignatures.add(`${qnx},${qny},${qnz}`)

    if (maxAxisComp < 0.96) {
      if (!isDuplicateDoubleSide) {
        nonOrthogonalTriCount += 1
      }
    } else if (ax >= ay && ax >= az) {
      if (normal.x >= 0) axisAreas.XPos += area
      else axisAreas.XNeg += area
    } else if (ay >= ax && ay >= az) {
      if (normal.y >= 0) axisAreas.YPos += area
      else axisAreas.YNeg += area
    } else {
      if (normal.z >= 0) axisAreas.ZPos += area
      else axisAreas.ZNeg += area
    }
  }

  // Primary broad face area (one side of the panel)
  const maxSingleSideFaceArea = Math.max(
    axisAreas.XPos,
    axisAreas.XNeg,
    axisAreas.YPos,
    axisAreas.YNeg,
    axisAreas.ZPos,
    axisAreas.ZNeg,
    totalArea * 0.45
  )
  const boxFaceArea = Math.max(1, width * length)
  const faceFillRatio = Math.min(1.0, maxSingleSideFaceArea / boxFaceArea)

  // 1. Zero-thickness / zero-volume filter (< 2 mm true thickness)
  const isZeroThickness =
    thickness < MIN_VALID_THICKNESS_MM ||
    width < MIN_VALID_THICKNESS_MM ||
    length < MIN_VALID_THICKNESS_MM ||
    totalArea < 10

  // 2. Strict Rectilinear Board Check:
  //    Any flat rectilinear board (orthogonal normals, <= 24 triangles, thickness between 6mm and 25mm)
  //    MUST be classified as a standard cuttable sheet panel — never tagged as ORNAMENT.
  const isRectilinearBoard =
    !isZeroThickness &&
    thickness >= MIN_BOARD_THICKNESS_MM - 0.5 &&
    thickness <= MAX_BOARD_THICKNESS_MM + 0.5 &&
    (validTriCount <= 24 || (nonOrthogonalTriCount <= 4 && normalSignatures.size <= 5))

  // 3. Strict Ornament Check:
  //    Only tag a mesh with `isOrnament: true` if it genuinely has curved, cylindrical, or
  //    complex non-rectilinear geometry (> 36 triangles with non-orthogonal curved normals).
  const isCurvedOrnament =
    !isZeroThickness &&
    !isRectilinearBoard &&
    validTriCount > 36 &&
    nonOrthogonalTriCount >= 6 &&
    normalSignatures.size >= 5

  return {
    ...obb,
    thickness,
    width,
    length,
    triCount: validTriCount,
    nonOrthogonalTriCount,
    distinctNormalBuckets: normalSignatures.size,
    totalArea,
    actualFaceArea: maxSingleSideFaceArea,
    boxFaceArea,
    faceFillRatio,
    isZeroThickness,
    isCurvedOrnament,
    isRectilinearBoard,
  }
}

/**
 * Analyzes sorted bounding box extents `[thickness, width, length]` (in mm) to
 * classify whether a mesh is `'flat_board'`, `'compound_carcass'`, or `'hardware_or_foot'`.
 */
export function evaluateMeshGeometryKind(dx, dy, dz) {
  const [thickness, width, length] = [dx, dy, dz].sort((a, b) => a - b)
  const surfaceAreaMm2 = width * length

  if (thickness < MIN_VALID_THICKNESS_MM) {
    return {
      kind: 'zero_thickness',
      thickness,
      width,
      length,
      surfaceAreaMm2,
    }
  }

  // Flat planar board (smallest dimension <= 25 mm and valid board span)
  if (
    thickness <= MAX_BOARD_THICKNESS_MM + 0.5 &&
    width >= MIN_SHEET_WIDTH_MM &&
    length >= MIN_SHEET_LENGTH_MM
  ) {
    return {
      kind: 'flat_board',
      thickness: Math.max(MIN_BOARD_THICKNESS_MM, Math.round(thickness)),
      width: Math.round(width),
      length: Math.round(length),
      surfaceAreaMm2,
    }
  }

  // Small blocky foot/support leg where all extents are <= 150 mm
  if (dx <= 150 && dy <= 150 && dz <= 150) {
    return {
      kind: 'hardware_or_foot',
      thickness,
      width,
      length,
      surfaceAreaMm2,
    }
  }

  // Multi-board carcass enclosure where ALL three bounding box extents exceed 50 mm
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
 * Removes duplicate/back-to-back coplanar triangles from a BufferGeometry so
 * `THREE.EdgesGeometry(geometry, 28)` never renders internal diagonal spiderweb lines.
 */
export function cleanGeometryForCrispEdges(geometry) {
  if (!geometry || !geometry.attributes?.position) return geometry
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  const posAttr = nonIndexed.attributes.position
  const triCount = Math.floor(posAttr.count / 3)
  if (triCount < 2 || triCount > 30000) return geometry

  const keptTris = []
  const seenUndirectedTris = new Set()

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3
    const verts = []
    for (let v = 0; v < 3; v++) {
      const idx = i0 + v
      const qx = Math.round(posAttr.getX(idx) * 5)
      const qy = Math.round(posAttr.getY(idx) * 5)
      const qz = Math.round(posAttr.getZ(idx) * 5)
      verts.push(`${qx},${qy},${qz}`)
    }
    // Ignore degenerate zero-area line triangles
    if (verts[0] === verts[1] || verts[1] === verts[2] || verts[0] === verts[2]) {
      continue
    }
    const sortedKey = [...verts].sort().join('|')
    if (seenUndirectedTris.has(sortedKey)) {
      continue
    }
    seenUndirectedTris.add(sortedKey)
    keptTris.push(t)
  }

  if (keptTris.length === triCount || keptTris.length === 0) {
    return geometry
  }

  const cleanPositions = new Float32Array(keptTris.length * 9)
  let wIdx = 0
  for (let i = 0; i < keptTris.length; i++) {
    const baseV = keptTris[i] * 3
    for (let v = 0; v < 3; v++) {
      cleanPositions[wIdx++] = posAttr.getX(baseV + v)
      cleanPositions[wIdx++] = posAttr.getY(baseV + v)
      cleanPositions[wIdx++] = posAttr.getZ(baseV + v)
    }
  }
  const cleanGeo = new THREE.BufferGeometry()
  cleanGeo.setAttribute('position', new THREE.BufferAttribute(cleanPositions, 3))
  cleanGeo.computeVertexNormals()
  cleanGeo.computeBoundingBox()
  return cleanGeo
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
 * Tests whether 2D point `(px, py)` lies inside or on the boundary of 2D triangle `(uA,vA)-(uB,vB)-(uC,vC)`.
 */
function isPointInTriangle2D(px, py, uA, vA, uB, vB, uC, vC) {
  const d1 = (px - uB) * (vA - vB) - (uA - uB) * (py - vB)
  const d2 = (px - uC) * (vB - vC) - (uB - uC) * (py - vC)
  const d3 = (px - uA) * (vC - vA) - (uC - uA) * (py - vA)
  const hasNeg = d1 < -1e-3 || d2 < -1e-3 || d3 < -1e-3
  const hasPos = d1 > 1e-3 || d2 > 1e-3 || d3 > 1e-3
  return !(hasNeg && hasPos)
}

/**
 * Computes the signed 2D area of triangle `(uA,vA)-(uB,vB)-(uC,vC)`.
 */
function triangleArea2D(uA, vA, uB, vB, uC, vC) {
  return 0.5 * Math.abs((uB - uA) * (vC - vA) - (vB - vA) * (uC - uA))
}

/**
 * Clips a list of 2D triangles `[{ uA, vA, uB, vB, uC, vC, area }]` against a 1D half-plane:
 *  - `axis === 'U'` and `keepLessOrEqual === true`: keeps `u <= splitVal`
 *  - `axis === 'U'` and `keepLessOrEqual === false`: keeps `u >= splitVal`
 *  - `axis === 'V'` and `keepLessOrEqual === true`: keeps `v <= splitVal`
 *  - `axis === 'V'` and `keepLessOrEqual === false`: keeps `v >= splitVal`
 * Uses exact Sutherland-Hodgman polygon clipping so diagonal triangles spanning across an
 * L-shaped step corner are cleanly sliced along the step line without leaking bounds.
 */
function clip2DTrianglesByHalfPlane(triList, axis, splitVal, keepLessOrEqual) {
  const result = []
  const isInside = (pt) => {
    const val = axis === 'U' ? pt.u : pt.v
    return keepLessOrEqual ? val <= splitVal + 1e-4 : val >= splitVal - 1e-4
  }
  const intersect = (p1, p2) => {
    if (axis === 'U') {
      const du = p2.u - p1.u
      const t = Math.abs(du) > 1e-6 ? (splitVal - p1.u) / du : 0
      return { u: splitVal, v: p1.v + t * (p2.v - p1.v) }
    } else {
      const dv = p2.v - p1.v
      const t = Math.abs(dv) > 1e-6 ? (splitVal - p1.v) / dv : 0
      return { u: p1.u + t * (p2.u - p1.u), v: splitVal }
    }
  }

  for (let i = 0; i < triList.length; i++) {
    const tr = triList[i]
    const poly = [
      { u: tr.uA, v: tr.vA },
      { u: tr.uB, v: tr.vB },
      { u: tr.uC, v: tr.vC },
    ]
    const clipped = []
    for (let e = 0; e < 3; e++) {
      const curr = poly[e]
      const next = poly[(e + 1) % 3]
      const inCurr = isInside(curr)
      const inNext = isInside(next)
      if (inCurr && inNext) {
        clipped.push(next)
      } else if (inCurr && !inNext) {
        clipped.push(intersect(curr, next))
      } else if (!inCurr && inNext) {
        clipped.push(intersect(curr, next))
        clipped.push(next)
      }
    }

    if (clipped.length >= 3) {
      const p0 = clipped[0]
      for (let k = 1; k < clipped.length - 1; k++) {
        const p1 = clipped[k]
        const p2 = clipped[k + 1]
        const a = triangleArea2D(p0.u, p0.v, p1.u, p1.v, p2.u, p2.v)
        if (a > 25.0) {
          result.push({
            uA: p0.u,
            vA: p0.v,
            uB: p1.u,
            vB: p1.v,
            uC: p2.u,
            vC: p2.v,
            uMin: Math.min(p0.u, p1.u, p2.u),
            uMax: Math.max(p0.u, p1.u, p2.u),
            vMin: Math.min(p0.v, p1.v, p2.v),
            vMax: Math.max(p0.v, p1.v, p2.v),
            area: a,
          })
        }
      }
    }
  }

  return result
}

/**
 * Computes the true 1-sided 2D polygon area (`actualArea`), bounding rectangle area (`rectArea`),
 * `fillRatio = actualArea / rectArea`, and deduplicated 2D triangles (`unique2DTris`) for a
 * coplanar panel cluster. Immune to double-sided SketchUp triangles (`+Z` and `-Z`) and
 * front/back face pairing.
 */
export function computeCoplanarPatchMetrics(tris, uMin, uMax, vMin, vMax) {
  const du = Math.max(1, uMax - uMin)
  const dv = Math.max(1, vMax - vMin)
  const rectArea = du * dv

  if (!tris || tris.length === 0) {
    return {
      actualArea: 0,
      rectArea,
      fillRatio: 0,
      unique2DTris: [],
    }
  }

  // 1. Deduplicate 2D triangles that share identical 2D vertices or 2D centroids
  //    (eliminates double-sided SketchUp faces and paired front+back faces)
  const seen2DKeys = new Set()
  const unique2DTris = []
  let uniqueSumArea = 0
  let posSignArea = 0
  let negSignArea = 0

  for (let i = 0; i < tris.length; i++) {
    const t = tris[i]
    const uA = t.uA ?? t.uMin
    const vA = t.vA ?? t.vMin
    const uB = t.uB ?? t.uMax
    const vB = t.vB ?? t.vMin
    const uC = t.uC ?? t.uMax
    const vC = t.vC ?? t.vMax
    const area = t.area || triangleArea2D(uA, vA, uB, vB, uC, vC)
    if (area < 5.0) continue

    if ((t.nSign ?? 1) >= 0) posSignArea += area
    else negSignArea += area

    const k1 = `${Math.round(uA * 0.5)},${Math.round(vA * 0.5)}`
    const k2 = `${Math.round(uB * 0.5)},${Math.round(vB * 0.5)}`
    const k3 = `${Math.round(uC * 0.5)},${Math.round(vC * 0.5)}`
    const sortedVerts = [k1, k2, k3].sort().join('|')
    const centroidKey = `c:${Math.round((uA + uB + uC) / 6)},${Math.round((vA + vB + vC) / 6)},${Math.round(area / 50)}`

    if (seen2DKeys.has(sortedVerts) || seen2DKeys.has(centroidKey)) {
      continue
    }
    seen2DKeys.add(sortedVerts)
    seen2DKeys.add(centroidKey)

    uniqueSumArea += area
    unique2DTris.push({
      ...t,
      uA,
      vA,
      uB,
      vB,
      uC,
      vC,
      uMin: Math.min(uA, uB, uC),
      uMax: Math.max(uA, uB, uC),
      vMin: Math.min(vA, vB, vC),
      vMax: Math.max(vA, vB, vC),
      area,
    })
  }

  // If both +normal and -normal faces were present, a single side cannot exceed max(posSignArea, negSignArea)
  const singleSideCap =
    posSignArea > 0 && negSignArea > 0
      ? Math.max(posSignArea, negSignArea)
      : uniqueSumArea

  // 2. Rasterize `unique2DTris` onto a 48x48 2D grid using exact point-in-triangle tests
  //    so overlapping coplanar triangles can never inflate `actualArea` above the true 2D silhouette.
  const GRID_N = 48
  const grid = new Uint8Array(GRID_N * GRID_N)
  let filledCount = 0

  for (let i = 0; i < unique2DTris.length; i++) {
    const tr = unique2DTris[i]
    const c0 = Math.max(0, Math.floor(((tr.uMin - uMin) / du) * GRID_N))
    const c1 = Math.min(GRID_N - 1, Math.floor(((tr.uMax - uMin) / du) * GRID_N))
    const r0 = Math.max(0, Math.floor(((tr.vMin - vMin) / dv) * GRID_N))
    const r1 = Math.min(GRID_N - 1, Math.floor(((tr.vMax - vMin) / dv) * GRID_N))

    for (let c = c0; c <= c1; c++) {
      const px = uMin + ((c + 0.5) / GRID_N) * du
      for (let r = r0; r <= r1; r++) {
        const idx = c * GRID_N + r
        if (grid[idx]) continue
        const py = vMin + ((r + 0.5) / GRID_N) * dv
        if (isPointInTriangle2D(px, py, tr.uA, tr.vA, tr.uB, tr.vB, tr.uC, tr.vC)) {
          grid[idx] = 1
          filledCount += 1
        }
      }
    }
  }

  const rasterArea = (filledCount / (GRID_N * GRID_N)) * rectArea
  const actualArea = Math.min(uniqueSumArea, singleSideCap, rasterArea * 1.04)
  const fillRatio = Math.min(1.0, actualArea / rectArea)

  return {
    actualArea,
    rectArea,
    fillRatio,
    unique2DTris,
  }
}

/**
 * Subdivides an L-shaped, U-shaped, or stepped 2D panel (`actualArea < 0.85 * rectArea`)
 * along its interior step vertex coordinates (`uSplit` or `vSplit`) into its actual
 * non-overlapping rectangular sub-panels for the Cutting List.
 */
export function subdivideStepped2DPanelIntoRectangles(
  unique2DTris,
  uMin,
  uMax,
  vMin,
  vMax,
  thickness = 18,
  depth = 0
) {
  const du = Math.max(1, uMax - uMin)
  const dv = Math.max(1, vMax - vMin)
  const rectArea = du * dv

  let actualArea = 0
  for (let i = 0; i < unique2DTris.length; i++) {
    actualArea += unique2DTris[i].area
  }
  const fillRatio = actualArea / rectArea

  const makeRectRecord = (u0, u1, v0, v1) => {
    const spanU = Math.max(1, Math.round(u1 - u0))
    const spanV = Math.max(1, Math.round(v1 - v0))
    const hVal = Math.max(2, Math.round(thickness))
    return {
      uMin: u0,
      uMax: u1,
      vMin: v0,
      vMax: v1,
      du: spanU,
      dv: spanV,
      thickness: hVal,
      l: Math.max(spanU, spanV),
      w: Math.min(spanU, spanV),
      h: hVal,
    }
  }

  if (
    fillRatio >= 0.85 ||
    depth >= 3 ||
    unique2DTris.length === 0 ||
    du < MIN_SHEET_WIDTH_MM * 1.5 ||
    dv < MIN_SHEET_WIDTH_MM * 1.5
  ) {
    return [makeRectRecord(uMin, uMax, vMin, vMax)]
  }

  // Collect candidate interior step coordinates from all triangle vertices
  const marginU = Math.max(35, du * 0.08)
  const marginV = Math.max(35, dv * 0.08)
  const rawUSplits = []
  const rawVSplits = []

  for (let i = 0; i < unique2DTris.length; i++) {
    const tr = unique2DTris[i]
    const us = [tr.uA, tr.uB, tr.uC]
    const vs = [tr.vA, tr.vB, tr.vC]
    for (let k = 0; k < 3; k++) {
      const u = Math.round(us[k])
      const v = Math.round(vs[k])
      if (u > uMin + marginU && u < uMax - marginU) rawUSplits.push(u)
      if (v > vMin + marginV && v < vMax - marginV) rawVSplits.push(v)
    }
  }

  const dedupeCoords = (arr) => {
    const sorted = [...new Set(arr)].sort((a, b) => a - b)
    const out = []
    for (let i = 0; i < sorted.length; i++) {
      if (out.length === 0 || sorted[i] - out[out.length - 1] >= 6) {
        out.push(sorted[i])
      }
    }
    return out
  }

  const uSplits = dedupeCoords(rawUSplits)
  const vSplits = dedupeCoords(rawVSplits)

  const measureClippedBounds = (tris) => {
    let cUMin = Infinity,
      cUMax = -Infinity,
      cVMin = Infinity,
      cVMax = -Infinity,
      cArea = 0
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i]
      if (t.uMin < cUMin) cUMin = t.uMin
      if (t.uMax > cUMax) cUMax = t.uMax
      if (t.vMin < cVMin) cVMin = t.vMin
      if (t.vMax > cVMax) cVMax = t.vMax
      cArea += t.area
    }
    return {
      uMin: cUMin,
      uMax: cUMax,
      vMin: cVMin,
      vMax: cVMax,
      du: Math.max(0, cUMax - cUMin),
      dv: Math.max(0, cVMax - cVMin),
      boxArea: Math.max(1, Math.max(0, cUMax - cUMin) * Math.max(0, cVMax - cVMin)),
      area: cArea,
    }
  }

  let bestSplit = null
  let bestScore = rectArea * 0.94 // require meaningful reduction in empty bounding box area

  // 1. Evaluate vertical splits `u = uSplit` (splits into Left section + Right section)
  for (let i = 0; i < uSplits.length; i++) {
    const uSplit = uSplits[i]
    const leftTris = clip2DTrianglesByHalfPlane(unique2DTris, 'U', uSplit, true)
    const rightTris = clip2DTrianglesByHalfPlane(unique2DTris, 'U', uSplit, false)
    if (leftTris.length === 0 || rightTris.length === 0) continue

    const bL = measureClippedBounds(leftTris)
    const bR = measureClippedBounds(rightTris)
    if (
      Math.min(bL.du, bL.dv) < MIN_SHEET_WIDTH_MM ||
      Math.min(bR.du, bR.dv) < MIN_SHEET_WIDTH_MM
    ) {
      continue
    }

    const combinedBoxArea = bL.boxArea + bR.boxArea
    // Slight 3% preference for vertical U-splits so tall wardrobe back panels remain full height
    const score = combinedBoxArea * 0.97
    if (score < bestScore) {
      bestScore = score
      bestSplit = {
        type: 'U',
        partA: { ...bL, tris: leftTris },
        partB: { ...bR, tris: rightTris },
      }
    }
  }

  // 2. Evaluate horizontal splits `v = vSplit` (splits into Bottom section + Top section)
  for (let i = 0; i < vSplits.length; i++) {
    const vSplit = vSplits[i]
    const botTris = clip2DTrianglesByHalfPlane(unique2DTris, 'V', vSplit, true)
    const topTris = clip2DTrianglesByHalfPlane(unique2DTris, 'V', vSplit, false)
    if (botTris.length === 0 || topTris.length === 0) continue

    const bB = measureClippedBounds(botTris)
    const bT = measureClippedBounds(topTris)
    if (
      Math.min(bB.du, bB.dv) < MIN_SHEET_WIDTH_MM ||
      Math.min(bT.du, bT.dv) < MIN_SHEET_WIDTH_MM
    ) {
      continue
    }

    const combinedBoxArea = bB.boxArea + bT.boxArea
    if (combinedBoxArea < bestScore) {
      bestScore = combinedBoxArea
      bestSplit = {
        type: 'V',
        partA: { ...bB, tris: botTris },
        partB: { ...bT, tris: topTris },
      }
    }
  }

  if (bestSplit) {
    const subA = subdivideStepped2DPanelIntoRectangles(
      bestSplit.partA.tris,
      bestSplit.partA.uMin,
      bestSplit.partA.uMax,
      bestSplit.partA.vMin,
      bestSplit.partA.vMax,
      thickness,
      depth + 1
    )
    const subB = subdivideStepped2DPanelIntoRectangles(
      bestSplit.partB.tris,
      bestSplit.partB.uMin,
      bestSplit.partB.uMax,
      bestSplit.partB.vMin,
      bestSplit.partB.vMax,
      thickness,
      depth + 1
    )
    const combined = [...subA, ...subB]
    // Sort so the largest/tallest section (e.g. Wardrobe Back Panel) comes first
    combined.sort((a, b) => b.l * b.w - a.l * a.w)
    return combined
  }

  return [makeRectRecord(uMin, uMax, vMin, vMax)]
}

/**
 * Builds a watertight 3D BufferGeometry by extruding the actual 2D polygon triangles
 * `unique2DTris` along `axis` (`'X'`, `'Y'`, or `'Z'`) by `thickness` around `pCenter`.
 * Preserves the exact L-shaped / stepped silhouette without filling open bays, and
 * ensures coplanar faces have 0-degree dihedral angles so `EdgesGeometry(geo, 28)`
 * renders only the crisp outer perimeter!
 */
function buildExtrudedPolygonGeometryFrom2DTris(
  unique2DTris,
  axis,
  pCenter,
  thickness = 18
) {
  const halfT = Math.max(1, thickness * 0.5)
  const pMin = pCenter - halfT
  const pMax = pCenter + halfT

  const to3D = (u, v, p) => {
    if (axis === 'Y') return [u, p, v]
    if (axis === 'X') return [p, u, v]
    return [u, v, p] // axis === 'Z'
  }

  // Ensure consistent 2D counter-clockwise orientation for every triangle
  const orientedTris = unique2DTris.map((t) => {
    const cross =
      (t.uB - t.uA) * (t.vC - t.vA) - (t.vB - t.vA) * (t.uC - t.uA)
    if (cross < 0) {
      return {
        uA: t.uA,
        vA: t.vA,
        uB: t.uC,
        vB: t.vC,
        uC: t.uB,
        vC: t.vB,
      }
    }
    return {
      uA: t.uA,
      vA: t.vA,
      uB: t.uB,
      vB: t.vB,
      uC: t.uC,
      vC: t.vC,
    }
  })

  // Detect exterior boundary edges (edges belonging to only 1 triangle) to stitch perimeter walls
  const edgeMap = new Map()
  const addEdge = (u1, v1, u2, v2) => {
    const k1 = `${Math.round(u1)},${Math.round(v1)}`
    const k2 = `${Math.round(u2)},${Math.round(v2)}`
    if (k1 === k2) return
    const undirectedKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
    if (!edgeMap.has(undirectedKey)) {
      edgeMap.set(undirectedKey, { count: 1, u1, v1, u2, v2 })
    } else {
      edgeMap.get(undirectedKey).count += 1
    }
  }

  for (let i = 0; i < orientedTris.length; i++) {
    const tr = orientedTris[i]
    addEdge(tr.uA, tr.vA, tr.uB, tr.vB)
    addEdge(tr.uB, tr.vB, tr.uC, tr.vC)
    addEdge(tr.uC, tr.vC, tr.uA, tr.vA)
  }

  const boundaryEdges = []
  for (const e of edgeMap.values()) {
    if (e.count === 1) boundaryEdges.push(e)
  }

  const totalOutTris = orientedTris.length * 2 + boundaryEdges.length * 2
  const positions = new Float32Array(totalOutTris * 9)
  let wIdx = 0

  const pushTri3D = (p0, p1, p2) => {
    positions[wIdx++] = p0[0]
    positions[wIdx++] = p0[1]
    positions[wIdx++] = p0[2]
    positions[wIdx++] = p1[0]
    positions[wIdx++] = p1[1]
    positions[wIdx++] = p1[2]
    positions[wIdx++] = p2[0]
    positions[wIdx++] = p2[1]
    positions[wIdx++] = p2[2]
  }

  // Front & back L-shaped faces
  for (let i = 0; i < orientedTris.length; i++) {
    const tr = orientedTris[i]
    const fA = to3D(tr.uA, tr.vA, pMax)
    const fB = to3D(tr.uB, tr.vB, pMax)
    const fC = to3D(tr.uC, tr.vC, pMax)
    pushTri3D(fA, fB, fC)

    const bA = to3D(tr.uA, tr.vA, pMin)
    const bB = to3D(tr.uB, tr.vB, pMin)
    const bC = to3D(tr.uC, tr.vC, pMin)
    pushTri3D(bA, bC, bB)
  }

  // Perimeter side walls along the L-shaped contour
  for (let i = 0; i < boundaryEdges.length; i++) {
    const e = boundaryEdges[i]
    const f1 = to3D(e.u1, e.v1, pMax)
    const f2 = to3D(e.u2, e.v2, pMax)
    const b1 = to3D(e.u1, e.v1, pMin)
    const b2 = to3D(e.u2, e.v2, pMin)
    pushTri3D(f1, b1, f2)
    pushTri3D(f2, b1, b2)
  }

  const extGeo = new THREE.BufferGeometry()
  extGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  extGeo.computeBoundingBox()
  const center = new THREE.Vector3()
  extGeo.boundingBox.getCenter(center)
  extGeo.translate(-center.x, -center.y, -center.z)
  extGeo.computeVertexNormals()
  extGeo.computeBoundingBox()
  return { geometry: extGeo, position: center }
}

/**
 * Decomposes a multi-board compound carcass mesh (`dx > 50 && dy > 50 && dz > 50`)
 * by clustering faces according to their orthogonal normals (±Y, ±X, ±Z),
 * pairing opposing parallel faces separated by board thickness (`<= 25 mm`),
 * preserving/extruding actual source polygon triangles when `actualArea < 0.85 * rectArea`,
 * and subdividing L-shaped / stepped panels into real rectangular sub-panels for the Cutting List.
 */
export function decomposeCompoundGeometry(geometry, parentWorldBox, defaultThickness = 18) {
  if (!geometry || !geometry.attributes?.position) {
    return { boards: [], hardware: [] }
  }

  const cleanedInput = cleanGeometryForCrispEdges(geometry)
  const nonIndexed = cleanedInput.index ? cleanedInput.toNonIndexed() : cleanedInput.clone()
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
        t,
        nSign: normal.y >= 0 ? 1 : -1,
        p: cy,
        pMin: yMin,
        pMax: yMax,
        uA: vA.x,
        vA: vA.z,
        uB: vB.x,
        vB: vB.z,
        uC: vC.x,
        vC: vC.z,
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
        t,
        nSign: normal.x >= 0 ? 1 : -1,
        p: (vA.x + vB.x + vC.x) / 3,
        pMin: xMin,
        pMax: xMax,
        uA: vA.y,
        vA: vA.z,
        uB: vB.y,
        vB: vB.z,
        uC: vC.y,
        vC: vC.z,
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
        t,
        nSign: normal.z >= 0 ? 1 : -1,
        p: (vA.z + vB.z + vC.z) / 3,
        pMin: zMin,
        pMax: zMax,
        uA: vA.x,
        vA: vA.y,
        uB: vB.x,
        vB: vB.y,
        uC: vC.x,
        vC: vC.y,
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
          rawAreaSum: t.area,
          pMin: t.pMin,
          pMax: t.pMax,
          uMin: t.uMin,
          uMax: t.uMax,
          vMin: t.vMin,
          vMax: t.vMax,
          tris: [t],
        })
      } else {
        const g = patchMap.get(r)
        g.pSum += t.p * t.area
        g.rawAreaSum += t.area
        g.pMin = Math.min(g.pMin, t.pMin)
        g.pMax = Math.max(g.pMax, t.pMax)
        g.uMin = Math.min(g.uMin, t.uMin)
        g.uMax = Math.max(g.uMax, t.uMax)
        g.vMin = Math.min(g.vMin, t.vMin)
        g.vMax = Math.max(g.vMax, t.vMax)
        g.tris.push(t)
      }
    }

    // 2. Filter valid coplanar face clusters using deduplicated 1-sided area
    const broadPatches = []
    for (const g of patchMap.values()) {
      const du = g.uMax - g.uMin
      const dv = g.vMax - g.vMin
      const minSpan = Math.min(du, dv)
      const maxSpan = Math.max(du, dv)
      if (minSpan < MIN_SHEET_WIDTH_MM || maxSpan < MIN_SHEET_LENGTH_MM) {
        continue
      }

      const metrics = computeCoplanarPatchMetrics(
        g.tris,
        g.uMin,
        g.uMax,
        g.vMin,
        g.vMax
      )
      if (
        metrics.actualArea < MIN_PANEL_SURFACE_AREA_MM2 ||
        metrics.fillRatio < 0.25
      ) {
        continue
      }

      broadPatches.push({
        ...g,
        p: g.pSum / Math.max(1e-5, g.rawAreaSum),
        du,
        dv,
        actualArea: metrics.actualArea,
        rectArea: metrics.rectArea,
        fillRatio: metrics.fillRatio,
      })
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
          tris: [...(p.tris || [])],
        })
      } else {
        const b = boardMap.get(r)
        b.pMin = Math.min(b.pMin, p.pMin)
        b.pMax = Math.max(b.pMax, p.pMax)
        b.uMin = Math.min(b.uMin, p.uMin)
        b.uMax = Math.max(b.uMax, p.uMax)
        b.vMin = Math.min(b.vMin, p.vMin)
        b.vMax = Math.max(b.vMax, p.vMax)
        if (p.tris) b.tris.push(...p.tris)
      }
    }

    // 4. Construct volumetric 3D board geometries:
    //    - If `actualArea >= 0.85 * rectArea`: generate standard rectangular `BoxGeometry`
    //    - If `actualArea < 0.85 * rectArea`: DO NOT use `BoxGeometry`! Extrude/preserve the
    //      actual source triangles for the 3D viewer, and subdivide the L-shaped / stepped
    //      polygon into real rectangular sub-panels for the Cutting List.
    for (const b of boardMap.values()) {
      const du = b.uMax - b.uMin
      const dv = b.vMax - b.vMin
      const minSpan = Math.min(du, dv)
      const maxSpan = Math.max(du, dv)
      const rectArea = du * dv

      if (
        minSpan < MIN_SHEET_WIDTH_MM ||
        maxSpan < MIN_SHEET_LENGTH_MM ||
        rectArea < MIN_PANEL_SURFACE_AREA_MM2
      ) {
        continue
      }

      const rawThick = b.pMax - b.pMin
      const thickness =
        rawThick >= MIN_BOARD_THICKNESS_MM && rawThick <= MAX_BOARD_THICKNESS_MM
          ? rawThick
          : defaultThickness
      const pCenter = (b.pMin + b.pMax) * 0.5

      const { actualArea, unique2DTris } = computeCoplanarPatchMetrics(
        b.tris,
        b.uMin,
        b.uMax,
        b.vMin,
        b.vMax
      )

      if (actualArea < 0.85 * rectArea && unique2DTris.length > 0) {
        const { geometry: preservedGeo, position: preservedPos } =
          buildExtrudedPolygonGeometryFrom2DTris(
            unique2DTris,
            axis,
            pCenter,
            thickness
          )
        const subPanels = subdivideStepped2DPanelIntoRectangles(
          unique2DTris,
          b.uMin,
          b.uMax,
          b.vMin,
          b.vMax,
          thickness
        )
        extractedBoards.push({
          geometry: preservedGeo,
          position: preservedPos,
          axis,
          pMin: pCenter - thickness * 0.5,
          pMax: pCenter + thickness * 0.5,
          parentBox: parentWorldBox.clone(),
          wasDecomposedFromCompound: true,
          preservedNonRectGeometry: true,
          subPanels,
        })
        continue
      }

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
        preservedNonRectGeometry: false,
        subPanels: null,
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
          const info = inspectGeometryCharacteristics(footGeo)
          if (info.isZeroThickness) return
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
              geometry: cleanGeometryForCrispEdges(footGeo),
              position: fCenter,
              isCurvedOrnament: info.isCurvedOrnament,
            })
          }
        })
      }
    }
  }

  return { boards: extractedBoards, hardware: extractedHardware }
}

/**
 * Spatial Co-Location & Redundant Face Deduplication Filter.
 * Preserves non-rectangular/stepped panels (`preservedNonRectGeometry`) without
 * replacing their geometry or merging unequal L-shaped spans.
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
      vMax = box.min.z
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

    if (axis === 'X') {
      vMax = box.max.z
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
      du: uMax - uMin,
      dv: vMax - vMin,
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
      !info.mesh.userData?.preservedNonRectGeometry &&
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
  const sortedByArea = [...panelInfos].sort((a, b) => b.area2D - a.area2D)

  for (let i = 0; i < sortedByArea.length; i++) {
    const primary = sortedByArea[i]
    if (primary.discard) continue

    for (let j = i + 1; j < sortedByArea.length; j++) {
      const secondary = sortedByArea[j]
      if (secondary.discard || primary.axis !== secondary.axis) continue

      if (
        primary.mesh.userData?.preservedNonRectGeometry ||
        secondary.mesh.userData?.preservedNonRectGeometry
      ) {
        continue
      }

      if (
        primary.axis === 'Y' &&
        isHorizontalStretcher(primary) !== isHorizontalStretcher(secondary)
      ) {
        continue
      }

      // Never merge two Z-facing back/front panels if they have substantially different heights/widths
      // (e.g. adjacent sub-panels of an L-shaped stepped back panel)
      if (
        primary.axis === 'Z' &&
        (Math.abs(primary.du - secondary.du) > 35 ||
          Math.abs(primary.dv - secondary.dv) > 35)
      ) {
        continue
      }

      const centerDist = Math.abs(primary.pCenter - secondary.pCenter)

      if (centerDist <= 25) {
        const overlap = compute2DOverlapRatio(primary, secondary, 8)
        if (overlap > 0.35) {
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
          }
          secondary.discard = true
        }
      }
    }
  }

  // 3. ENSURE FLUSH VERTICAL CONTACT BETWEEN DECOMPOSED INTERIOR DIVIDERS AND SUPPORTING SHELVES
  const activeHorizontals = panelInfos.filter(
    (info) => !info.discard && info.axis === 'Y'
  )
  const assemblyHeight = Math.max(1, assemblyBox.max.y - assemblyBox.min.y)

  panelInfos.forEach((divInfo) => {
    if (
      divInfo.discard ||
      divInfo.axis !== 'X' ||
      !divInfo.mesh.userData?.wasDecomposed ||
      divInfo.mesh.userData?.preservedNonRectGeometry
    ) {
      return
    }
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
      const xCovers =
        divInfo.center.x >= hInfo.box.min.x - 20 &&
        divInfo.center.x <= hInfo.box.max.x + 20
      const zOverlap =
        Math.min(divInfo.box.max.z, hInfo.box.max.z) -
        Math.max(divInfo.box.min.z, hInfo.box.min.z)
      if (!xCovers || zOverlap <= 20) return

      if (hInfo.center.y < divInfo.center.y) {
        const gapBelow = Math.abs(divInfo.box.min.y - hInfo.box.max.y)
        if (gapBelow > 0.1 && gapBelow <= bestBelowGap) {
          bestBelowGap = gapBelow
          targetMinY = hInfo.box.max.y
        }
      } else if (hInfo.center.y > divInfo.center.y) {
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
 * Dynamically names an ornament or non-sheet part based on its 3D shape, aspect ratio,
 * and vertical position in the cabinet assembly (removing hardcoded "Cabinet Foot / Leg").
 */
export function classifyOrnamentOrCustomPartName(
  dimsSorted,
  meshBox,
  assemblyBox,
  rawName = ''
) {
  const [L, W, H] = dimsSorted
  const boxHeight = meshBox ? meshBox.max.y - meshBox.min.y : H

  // 1. Small blocks/cylinders located at the very bottom (`panelBox.min.y <= assemblyBox.min.y + 15 mm` and height `< 150 mm`)
  if (
    meshBox &&
    assemblyBox &&
    !assemblyBox.isEmpty() &&
    meshBox.min.y <= assemblyBox.min.y + 15 &&
    boxHeight < 150 &&
    L <= 200
  ) {
    return 'Cabinet Foot / Leg'
  }

  // 2. Slender cylindrical poles/rods (circular cross-section where `W ≈ H` and `L > 3 * W`)
  if (
    W > 0 &&
    Math.abs(W - H) <= Math.max(8, W * 0.3) &&
    L > 3 * W
  ) {
    return 'Support Rod / Pole'
  }

  // 3. Cleaned custom SketchUp component/material name if present and non-ambiguous
  const cleanedRaw = String(rawName || '')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (cleanedRaw && !isAmbiguousCadName(cleanedRaw)) {
    return cleanedRaw
  }

  // 4. Large curved/oval flat panels or frames
  if (H <= 45 && L >= 120 && W >= 80) {
    return 'Oval / Curved Panel'
  }

  return 'Ornamental Part'
}

/**
 * Normalizes an uploaded 3D model (.dae or .obj) into centered millimeter (mm)
 * Y-up world coordinates, filters out zero-thickness (< 2mm) orphan discs,
 * preserves actual parsed triangle geometry for non-rectangular / L-shaped panels,
 * and separates curved ornaments (> 36 triangles with curved normals) from flat boards.
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
  const tempPos = new THREE.Vector3()
  const tempQuat = new THREE.Quaternion()
  const tempScale = new THREE.Vector3()

  rawMeshes.forEach((mesh) => {
    // Compute local unrotated geometry bounding box BEFORE baking world rotation
    mesh.geometry.computeBoundingBox()
    const localBox = mesh.geometry.boundingBox
    const bakedMatrix = new THREE.Matrix4().multiplyMatrices(
      worldToCenteredMm,
      mesh.matrixWorld
    )
    bakedMatrix.decompose(tempPos, tempQuat, tempScale)

    const localUnrotatedDims = localBox
      ? {
          dx: (localBox.max.x - localBox.min.x) * Math.abs(tempScale.x),
          dy: (localBox.max.y - localBox.min.y) * Math.abs(tempScale.y),
          dz: (localBox.max.z - localBox.min.z) * Math.abs(tempScale.z),
        }
      : null

    const clonedGeo = mesh.geometry.clone()
    clonedGeo.applyMatrix4(bakedMatrix)
    clonedGeo.computeBoundingBox()

    const rawName = mesh.name || mesh.parent?.name || ''
    preparedMeshes.push({
      geometry: clonedGeo,
      rawName,
      localUnrotatedDims,
    })
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

  const registerSpecialOrOrnamentMesh = (geo, rawName, localDims = null) => {
    const info = inspectGeometryCharacteristics(geo, localDims)
    // Filter out zero-thickness orphan meshes (< 2 mm)
    if (info.isZeroThickness) return

    // If this island is actually a flat rectilinear board (6mm..25mm, <= 24 tris),
    // route it to standard sheet panels instead of ornaments!
    if (
      info.isRectilinearBoard &&
      info.width >= MIN_SHEET_WIDTH_MM &&
      info.length >= MIN_SHEET_LENGTH_MM
    ) {
      geo.computeBoundingBox()
      const hb = geo.boundingBox
      if (!hb) return
      const center = new THREE.Vector3()
      hb.getCenter(center)
      const cleaned = cleanGeometryForCrispEdges(geo)
      cleaned.translate(-center.x, -center.y, -center.z)
      cleaned.computeVertexNormals()
      cleaned.computeBoundingBox()
      const panelMesh = new THREE.Mesh(cleaned)
      panelMesh.position.copy(center)
      panelMesh.name = rawName
      panelMesh.userData = {
        rawOriginalName: rawName,
        wasDecomposed: false,
        isHardware: false,
        isOrnament: false,
        localDimensionsMm: { dx: info.dx, dy: info.dy, dz: info.dz },
      }
      loadedModel.add(panelMesh)
      candidatePanelMeshes.push(panelMesh)
      return
    }

    geo.computeBoundingBox()
    const hb = geo.boundingBox
    if (!hb) return
    const hSize = new THREE.Vector3()
    hb.getSize(hSize)
    if (Math.max(hSize.x, hSize.y, hSize.z) < 10) return

    const geomCenter = new THREE.Vector3()
    hb.getCenter(geomCenter)
    const cleaned = cleanGeometryForCrispEdges(geo)
    cleaned.translate(-geomCenter.x, -geomCenter.y, -geomCenter.z)
    cleaned.computeVertexNormals()
    cleaned.computeBoundingBox()

    const hwMesh = new THREE.Mesh(cleaned)
    hwMesh.position.copy(geomCenter)
    hwMesh.name = rawName || 'Ornamental Part'
    hwMesh.userData = {
      rawOriginalName: rawName,
      isHardware: true,
      isOrnament: info.isCurvedOrnament,
      isRectilinearBoard: info.isRectilinearBoard,
      triCount: info.triCount,
      nonOrthogonalTriCount: info.nonOrthogonalTriCount,
      dimensionsMm: { dx: info.dx, dy: info.dy, dz: info.dz },
      localDimensionsMm: { dx: info.dx, dy: info.dy, dz: info.dz },
    }
    loadedModel.add(hwMesh)
    hardwareMeshes.push(hwMesh)
  }

  // 3. Evaluate each mesh dynamically
  preparedMeshes.forEach(({ geometry, rawName, localUnrotatedDims }) => {
    const islands = splitDisconnectedGeometryIslands(geometry, 4)
    const hasMultipleIslands = islands.length > 1

    islands.forEach((islGeo) => {
      const effectiveLocalDims = hasMultipleIslands ? null : localUnrotatedDims
      const info = inspectGeometryCharacteristics(islGeo, effectiveLocalDims)

      // 3a. Ignore/discard any mesh whose true thickness is < 2 mm or has zero 3D volume
      if (info.isZeroThickness) {
        return
      }

      // 3b. Curved, cylindrical, or complex non-rectilinear ornament (> 36 tris with curved normals)
      if (info.isCurvedOrnament) {
        registerSpecialOrOrnamentMesh(islGeo, rawName, effectiveLocalDims)
        return
      }

      const evalResult = evaluateMeshGeometryKind(info.dx, info.dy, info.dz)
      if (evalResult.kind === 'zero_thickness') {
        return
      }

      // 3c. Small sub-threshold blocks or cabinet feet
      if (evalResult.kind === 'hardware_or_foot' && !info.isRectilinearBoard) {
        registerSpecialOrOrnamentMesh(islGeo, rawName, effectiveLocalDims)
        return
      }

      // 3d. Compound Multi-Board Carcass (`dx > 50 && dy > 50 && dz > 50` and not a flat board)
      if (evalResult.kind === 'compound_carcass' && !info.isRectilinearBoard) {
        islGeo.computeBoundingBox()
        const box = islGeo.boundingBox
        const { boards, hardware } = decomposeCompoundGeometry(islGeo, box, 18)
        if (boards.length === 0 && hardware.length === 0) {
          registerSpecialOrOrnamentMesh(islGeo, rawName, effectiveLocalDims)
          return
        }

        boards.forEach((board) => {
          const bInfo = inspectGeometryCharacteristics(board.geometry)
          if (bInfo.isZeroThickness) return
          const panelMesh = new THREE.Mesh(board.geometry)
          panelMesh.position.copy(board.position)
          panelMesh.name = rawName
          panelMesh.userData = {
            rawOriginalName: rawName,
            parentCompoundBox: board.parentBox,
            wasDecomposed: true,
            preservedNonRectGeometry: Boolean(board.preservedNonRectGeometry),
            subPanels: board.subPanels || null,
            isHardware: false,
            isOrnament: false,
            localDimensionsMm: { dx: bInfo.dx, dy: bInfo.dy, dz: bInfo.dz },
          }
          loadedModel.add(panelMesh)
          candidatePanelMeshes.push(panelMesh)
        })

        hardware.forEach((hw) => {
          const hwInfo = inspectGeometryCharacteristics(hw.geometry)
          if (hwInfo.isZeroThickness) return
          const hwMesh = new THREE.Mesh(hw.geometry)
          hwMesh.position.copy(hw.position)
          hwMesh.name = rawName
          hwMesh.userData = {
            rawOriginalName: rawName,
            isHardware: true,
            isOrnament: Boolean(hw.isCurvedOrnament && !hwInfo.isRectilinearBoard),
            isRectilinearBoard: hwInfo.isRectilinearBoard,
            dimensionsMm: { dx: hwInfo.dx, dy: hwInfo.dy, dz: hwInfo.dz },
            localDimensionsMm: { dx: hwInfo.dx, dy: hwInfo.dy, dz: hwInfo.dz },
          }
          loadedModel.add(hwMesh)
          hardwareMeshes.push(hwMesh)
        })
        return
      }

      // 3e. Flat planar board (`thickness <= 25 mm`):
      //     Check if it is an L-shaped or stepped non-rectangular panel (`faceFillRatio < 0.85`).
      islGeo.computeBoundingBox()
      const box = islGeo.boundingBox
      if (!box) return

      if (info.faceFillRatio < 0.85) {
        // Preserve actual polygon geometry in the 3D viewer and subdivide into rectangular
        // sub-panels (`board.subPanels`) for the Cutting List!
        const { boards } = decomposeCompoundGeometry(
          islGeo,
          box,
          Math.round(info.thickness) || 18
        )
        if (boards.length >= 1) {
          boards.forEach((board) => {
            const bInfo = inspectGeometryCharacteristics(board.geometry)
            if (bInfo.isZeroThickness) return
            const panelMesh = new THREE.Mesh(board.geometry)
            panelMesh.position.copy(board.position)
            panelMesh.name = rawName
            panelMesh.userData = {
              rawOriginalName: rawName,
              parentCompoundBox: board.parentBox,
              wasDecomposed: true,
              preservedNonRectGeometry: Boolean(board.preservedNonRectGeometry),
              subPanels: board.subPanels || null,
              isHardware: false,
              isOrnament: false,
              localDimensionsMm: { dx: bInfo.dx, dy: bInfo.dy, dz: bInfo.dz },
            }
            loadedModel.add(panelMesh)
            candidatePanelMeshes.push(panelMesh)
          })
          return
        }
      }

      // Preserve the actual parsed triangle geometry (never replacing non-rectangular or recessed-handle meshes with BoxGeometry)
      const geomCenter = new THREE.Vector3()
      box.getCenter(geomCenter)
      const finalGeometry = cleanGeometryForCrispEdges(islGeo)
      finalGeometry.translate(-geomCenter.x, -geomCenter.y, -geomCenter.z)
      finalGeometry.computeVertexNormals()
      finalGeometry.computeBoundingBox()

      const mesh = new THREE.Mesh(finalGeometry)
      mesh.position.copy(geomCenter)
      mesh.name = rawName
      mesh.userData = {
        rawOriginalName: rawName,
        wasDecomposed: false,
        preservedNonRectGeometry: info.faceFillRatio < 0.85,
        subPanels: null,
        isHardware: false,
        isOrnament: false,
        localDimensionsMm: { dx: info.dx, dy: info.dy, dz: info.dz },
      }
      loadedModel.add(mesh)
      candidatePanelMeshes.push(mesh)
    })
  })

  loadedModel.updateMatrixWorld(true)

  // Compute structural carcass bounding box from sheet-good panels
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
 * and configures ornament / non-sheet component naming & explosion kinematics.
 */
export function classifyCabinetPanels(loadedModel, options = {}) {
  if (!loadedModel) {
    return { assemblyBox: new THREE.Box3(), panels: [], hardware: [] }
  }

  const preserveExplicitName = Boolean(options.preserveExplicitName)
  loadedModel.updateMatrixWorld(true)

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

    const worldDx = panelBox.max.x - panelBox.min.x
    const worldDy = panelBox.max.y - panelBox.min.y
    const worldDz = panelBox.max.z - panelBox.min.z

    const localDims = child.userData?.localDimensionsMm
    const dx = localDims?.dx > 0 ? localDims.dx : worldDx
    const dy = localDims?.dy > 0 ? localDims.dy : worldDy
    const dz = localDims?.dz > 0 ? localDims.dz : worldDz

    let role = 'Shelf'
    let axisType = 'horizontal' // 'horizontal' | 'vertical' | 'facing'

    // 1. Horizontal panel (Y is thin axis)
    if (worldDy <= worldDx && worldDy <= worldDz) {
      axisType = 'horizontal'
      const minPlanarW = Math.min(worldDx, worldDz)
      const assemblyDepth = Math.max(1, assemblySize.z)
      const isNarrowStretcher =
        minPlanarW <= 120 / scaleFactor ||
        worldDz < 0.35 * assemblyDepth ||
        worldDz < 0.65 * assemblyDepth

      if (isNarrowStretcher) {
        role =
          panelCenter.y >= assemblyCenter.y ? 'Top Stretcher' : 'Cabinet Rail'
      } else if (panelBox.max.y >= assemblyBox.max.y - tolerance) {
        role = 'Top Panel'
      } else if (
        panelBox.min.y <=
        assemblyBox.min.y + Math.max(tolerance, assemblyHeight * 0.18)
      ) {
        role = 'Bottom Panel'
      } else {
        role = 'Shelf'
      }
    }
    // 2. Vertical side panel / divider (X is thin axis)
    else if (worldDx <= worldDy && worldDx <= worldDz) {
      axisType = 'vertical'
      const isFullHeightSide = worldDy >= assemblyHeight * 0.55
      if (panelBox.min.x <= assemblyBox.min.x + tolerance && isFullHeightSide) {
        role = 'Left Side Panel'
      } else if (
        panelBox.max.x >= assemblyBox.max.x - tolerance &&
        isFullHeightSide
      ) {
        role = 'Right Side Panel'
      } else if (worldDy <= 260 / scaleFactor) {
        role = 'Drawer Panel'
      } else {
        role = 'Vertical Divider'
      }
    }
    // 3. Facing panel (Z is thin axis)
    else {
      axisType = 'facing'
      if (panelBox.min.z <= assemblyBox.min.z + tolerance) {
        role = 'Back Panel'
      } else if (panelBox.max.z >= assemblyBox.max.z - tolerance) {
        role = worldDy <= 280 / scaleFactor ? 'Drawer Panel' : 'Front Face / Door'
      } else {
        role =
          panelCenter.z < assemblyCenter.z
            ? 'Back Panel'
            : worldDy <= 280 / scaleFactor
            ? 'Drawer Panel'
            : 'Front Face / Door'
      }
    }

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
        explodeDir.set(0, dir.y >= 0 ? 0.45 : -0.45, 0)
      }
    } else if (axisType === 'vertical') {
      if (role === 'Left Side Panel') {
        explodeDir.set(-1, 0, 0)
      } else if (role === 'Right Side Panel') {
        explodeDir.set(1, 0, 0)
      } else {
        explodeDir.set(Math.abs(dir.x) > 25 ? (dir.x > 0 ? 0.5 : -0.5) : 0, 0.45, 0)
      }
    } else {
      if (role === 'Back Panel') {
        explodeDir.set(0, 0, -1)
      } else if (role === 'Front Face / Door' || role === 'Drawer Panel') {
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
      isOrnament: false,
      subPanels: child.userData?.subPanels || null,
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
      isOrnament: false,
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

  // Configure ornament & custom non-sheet meshes dynamically (no hardcoded "Cabinet Foot / Leg")
  const fullModelBox = new THREE.Box3().setFromObject(loadedModel)
  const hardwareRecords = []

  hwMeshes.forEach((hwMesh, hwIdx) => {
    const hwBox = new THREE.Box3().setFromObject(hwMesh)
    const hwCenter = hwBox.getCenter(new THREE.Vector3())
    const localDims = hwMesh.userData?.localDimensionsMm
    const obb = computeTightOBBDimensions(hwMesh.geometry, localDims)

    // Filter out any residual < 2mm zero-thickness cap
    if (obb.h < MIN_VALID_THICKNESS_MM) {
      hwMesh.parent?.remove(hwMesh)
      hwMesh.geometry?.dispose()
      return
    }

    const sortedDims = [obb.l, obb.w, obb.h].map((v) => Math.max(2, Math.round(v)))
    const isGenuineOrnament = Boolean(hwMesh.userData?.isOrnament)
    const rawName = hwMesh.userData?.rawOriginalName || hwMesh.name || ''

    const dynamicRoleName = classifyOrnamentOrCustomPartName(
      sortedDims,
      hwBox,
      fullModelBox,
      rawName
    )

    const dir = hwCenter.clone().sub(assemblyCenter)
    const explodeDir =
      dynamicRoleName === 'Cabinet Foot / Leg'
        ? new THREE.Vector3(0, -0.85, 0)
        : dir.lengthSq() > 1
        ? dir.normalize().multiplyScalar(0.6)
        : new THREE.Vector3(0, 0.5, 0.5)

    hwMesh.name = dynamicRoleName
    hwMesh.userData = {
      ...hwMesh.userData,
      isHardware: false,
      isOrnament: isGenuineOrnament,
      category: isGenuineOrnament ? 'ornament' : dynamicRoleName.toLowerCase(),
      meshUuid: hwMesh.uuid,
      panelRole: dynamicRoleName,
      partName: dynamicRoleName,
      hardwareIndex: hwIdx,
      basePosition: hwMesh.position.clone(),
      explodeDir,
      dimensionsMm: { dx: obb.dx, dy: obb.dy, dz: obb.dz },
    }

    hardwareRecords.push({
      mesh: hwMesh,
      hardwareIndex: hwIdx,
      box: hwBox,
      center: hwCenter,
      dx: sortedDims[0],
      dy: sortedDims[1],
      dz: sortedDims[2],
      role: dynamicRoleName,
      isOrnament: isGenuineOrnament,
      explodeDir,
    })
  })

  return {
    assemblyBox,
    assemblyCenter,
    assemblySize,
    panels: panelRecords,
    hardware: hardwareRecords,
  }
}
