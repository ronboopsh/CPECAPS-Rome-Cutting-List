/**
 * ============================================================================
 * MODULE 1: MULTI-PROJECT CUTLIST AGGREGATOR, DYNAMIC FUZZY CONSOLIDATOR &
 * SAW-SETUP RIP SORTER (`src/utils/aggregator.js`)
 * Rome Cabinets - Automated Cutting List & Shop-Floor Coordinator
 * ============================================================================
 */

export const PROJECT_SCHEDULES = {
  'Job #1': {
    id: 'Job #1',
    shortLabel: 'Job 1 (Kitchen)',
    fullName: 'Job #1: Galvez Kitchen',
    client: 'Galvez Residence',
    presetType: 'kitchen',
    modelFile: null,
    modelUrl: null,
    parts: [
      {
        id: 101,
        num: '#1',
        part: 'Side Panel',
        panelRole: 'Side Panel',
        qty: 2,
        l: 750,
        w: 500,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['k-left-side', 'k-right-side'],
        source_jobs: ['Job #1'],
      },
      {
        id: 102,
        num: '#2',
        part: 'Base Shelf',
        panelRole: 'Bottom Panel',
        qty: 1,
        l: 564,
        w: 480,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['k-bottom-deck'],
        source_jobs: ['Job #1'],
      },
      {
        id: 103,
        num: '#3',
        part: 'Adjustable Shelf',
        panelRole: 'Shelf #1',
        qty: 1,
        l: 564,
        w: 460,
        h: 18,
        corner: 'None',
        material: '18mm Marine Plywood',
        meshUuids: ['k-mid-shelf'],
        source_jobs: ['Job #1'],
      },
      {
        id: 104,
        num: '#4',
        part: 'Top Stretcher',
        panelRole: 'Top Stretcher',
        qty: 2,
        l: 564,
        w: 100,
        h: 18,
        corner: 'None',
        material: '18mm Marine Plywood',
        meshUuids: ['k-top-stretcher-f', 'k-top-stretcher-b'],
        source_jobs: ['Job #1'],
      },
      {
        id: 105,
        num: '#5',
        part: 'Cabinet Door Slab',
        panelRole: 'Front Face / Door',
        qty: 2,
        l: 746,
        w: 296,
        h: 18,
        corner: 'Edge 2x',
        material: 'MDF',
        meshUuids: ['k-door-left', 'k-door-right'],
        source_jobs: ['Job #1'],
      },
      {
        id: 106,
        num: '#6',
        part: 'Top Panel',
        panelRole: 'Top Panel',
        qty: 1,
        l: 600,
        w: 500,
        h: 18,
        corner: 'Edge 1x',
        material: 'MDF',
        meshUuids: ['k-top-panel'],
        source_jobs: ['Job #1'],
      },
    ],
  },
  'Job #2': {
    id: 'Job #2',
    shortLabel: 'Job 2 (Wardrobe)',
    fullName: 'Job #2: Wardrobe Unit',
    client: 'Master Suite Fit-Out',
    presetType: 'wardrobe',
    modelFile: null,
    modelUrl: null,
    parts: [
      {
        id: 201,
        num: '#7',
        part: 'Wardrobe Tall Gable',
        panelRole: 'Side Panel',
        qty: 2,
        l: 2100,
        w: 600,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['w-left-gable', 'w-right-gable'],
        source_jobs: ['Job #2'],
      },
      {
        id: 202,
        num: '#8',
        part: 'Center Gable / Divider',
        panelRole: 'Vertical Divider',
        qty: 1,
        l: 1512,
        w: 560,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['w-center-divider'],
        source_jobs: ['Job #2'],
      },
      {
        id: 203,
        num: '#9',
        part: 'Upper Fixed Shelf',
        panelRole: 'Shelf #3',
        qty: 1,
        l: 864,
        w: 560,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['w-upper-shelf'],
        source_jobs: ['Job #2'],
      },
      {
        id: 204,
        num: '#10',
        part: 'Right-Bay Cubby Shelf',
        panelRole: 'Shelf',
        qty: 2,
        l: 423,
        w: 560,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['w-mid-shelf-1', 'w-mid-shelf-2'],
        source_jobs: ['Job #2'],
      },
      {
        id: 205,
        num: '#11',
        part: 'Top Panel',
        panelRole: 'Top Panel',
        qty: 1,
        l: 900,
        w: 600,
        h: 18,
        corner: 'Edge 1x',
        material: 'MDF',
        meshUuids: ['w-top-cap'],
        source_jobs: ['Job #2'],
      },
      {
        id: 206,
        num: '#12',
        part: 'Bottom Panel',
        panelRole: 'Bottom Panel',
        qty: 1,
        l: 864,
        w: 580,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['w-bottom-deck'],
        source_jobs: ['Job #2'],
      },
      {
        id: 207,
        num: '#13',
        part: 'Valance Rail',
        panelRole: 'Valance Rail',
        qty: 1,
        l: 864,
        w: 100,
        h: 18,
        corner: 'None',
        material: '18mm Marine Plywood',
        meshUuids: ['w-valance-rail'],
        source_jobs: ['Job #2'],
      },
    ],
  },
  'Job #3': {
    id: 'Job #3',
    shortLabel: 'Job 3 (Drawer Bank)',
    fullName: 'Job #3: Drawer Bank',
    client: 'Workshop Island Unit',
    presetType: 'drawer_bank',
    modelFile: null,
    modelUrl: null,
    parts: [
      {
        id: 301,
        num: '#14',
        part: 'Side Panel',
        panelRole: 'Side Panel',
        qty: 2,
        l: 750,
        w: 500,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['d-left-side', 'd-right-side'],
        source_jobs: ['Job #3'],
      },
      {
        id: 302,
        num: '#15',
        part: 'Drawer Box Side',
        panelRole: 'Drawer Box Side',
        qty: 6,
        l: 450,
        w: 160,
        h: 18,
        corner: 'None',
        material: '18mm Marine Plywood',
        meshUuids: [
          'd-box-top-l',
          'd-box-top-r',
          'd-box-mid-l',
          'd-box-mid-r',
          'd-box-bot-l',
          'd-box-bot-r',
        ],
        source_jobs: ['Job #3'],
      },
      {
        id: 303,
        num: '#16',
        part: 'Drawer Front Face',
        panelRole: 'Front Face / Door',
        qty: 3,
        l: 746,
        w: 296,
        h: 18,
        corner: 'Edge 2x',
        material: 'MDF',
        meshUuids: ['d-front-top', 'd-front-mid', 'd-front-bot'],
        source_jobs: ['Job #3'],
      },
      {
        id: 304,
        num: '#17',
        part: 'Top Stretcher',
        panelRole: 'Top Stretcher',
        qty: 2,
        l: 564,
        w: 100,
        h: 18,
        corner: 'None',
        material: '18mm Marine Plywood',
        meshUuids: ['d-top-stretcher-f', 'd-top-stretcher-b'],
        source_jobs: ['Job #3'],
      },
      {
        id: 305,
        num: '#18',
        part: 'Bottom Panel',
        panelRole: 'Bottom Panel',
        qty: 1,
        l: 564,
        w: 480,
        h: 18,
        corner: 'Edge 1x',
        material: '18mm Marine Plywood',
        meshUuids: ['d-bottom-stretcher'],
        source_jobs: ['Job #3'],
      },
    ],
  },
}

/**
 * Generates a normalized composite signature key for exact part matching.
 */
export function getPartIdentityKey(part) {
  const mat = String(part.material || 'MDF').trim().toLowerCase()
  const h = Number(part.h) || 0
  const w = Number(part.w) || 0
  const l = Number(part.l) || 0
  return `${mat}::h=${h}::w=${w}::l=${l}`
}

export function getPartRoleFamily(part) {
  const raw = String(part?.panelRole || part?.part || '').trim().toLowerCase()
  if (part?.isOrnament) return raw ? `ornament::${raw}` : 'ornament'
  if (!raw) return 'panel'
  if (raw.includes('stretcher') || raw.includes('rail') || raw.includes('valance')) {
    return 'stretcher'
  }
  if (raw.includes('divider') || raw.includes('partition')) return 'divider'
  if (raw.includes('drawer') && raw.includes('side')) return 'drawer_side'
  if (raw.includes('side') || raw.includes('gable')) return 'side'
  if (raw.includes('top')) return 'top'
  if (raw.includes('bottom') || raw.includes('base shelf')) return 'bottom'
  if (raw.includes('back')) return 'back'
  if (raw.includes('door') || raw.includes('front') || raw.includes('slab')) return 'door'
  if (raw.includes('shelf')) return 'shelf'
  return raw
}

/**
 * Dynamic Fuzzy Matching Criteria for Identical & Near-Identical Parts:
 *  1. Material Match: Exact normalized material string (case-insensitive).
 *  2. Thickness (H) Match: `|H_a - H_b| <= 0.5 mm`.
 *  3. Length (L) & Width (W) Tolerance:
 *     - Direct: `|L_a - L_b| <= 2.0 mm` AND `|W_a - W_b| <= 2.0 mm`
 *     - Transposed: `|L_a - W_b| <= 2.0 mm` AND `|W_a - L_b| <= 2.0 mm`
 *  4. Edge / Corner Processing: Identical corner cuts or edge banding configurations
 *     (or compatible when `requireStrictCorner` is false).
 */
export function arePartsNearIdentical(partA, partB, options = {}) {
  if (!partA || !partB) return false
  const requireStrictCorner = options.requireStrictCorner ?? true
  const matchRoleFamily = options.matchRoleFamily ?? false

  // Never merge an ornament part with a standard flat sheet panel
  const isOrnA = Boolean(partA.isOrnament)
  const isOrnB = Boolean(partB.isOrnament)
  if (isOrnA !== isOrnB) return false

  // 1. Material Match (case-insensitive)
  const matA = String(partA.material || '18mm Marine Plywood').trim().toLowerCase()
  const matB = String(partB.material || '18mm Marine Plywood').trim().toLowerCase()
  if (matA !== matB) return false

  // 2. Thickness (H) Match within 0.5 mm (or 2.0 mm for 3D ornaments)
  const hA = Number(partA.h) || 0
  const hB = Number(partB.h) || 0
  const hTol = isOrnA ? 2.0 : 0.5
  if (Math.abs(hA - hB) > hTol) return false

  // 3. Length (L) & Width (W) Tolerance within 2.0 mm (including transposed orientation)
  const lA = Number(partA.l) || 0
  const wA = Number(partA.w) || 0
  const lB = Number(partB.l) || 0
  const wB = Number(partB.w) || 0

  const directMatch = Math.abs(lA - lB) <= 2.0 && Math.abs(wA - wB) <= 2.0
  const transposedMatch = Math.abs(lA - wB) <= 2.0 && Math.abs(wA - lB) <= 2.0
  if (!directMatch && !transposedMatch) return false

  // 4. Edge / Corner Processing
  if (requireStrictCorner) {
    const cornerA = String(partA.corner || 'Edge 1x').trim().toLowerCase()
    const cornerB = String(partB.corner || 'Edge 1x').trim().toLowerCase()
    if (cornerA !== cornerB) return false
  }

  // Prevent incompatible structural categories (e.g., Stretchers vs Shelves/Top, or Dividers vs Side Gables)
  const famA = getPartRoleFamily(partA)
  const famB = getPartRoleFamily(partB)
  if ((famA === 'stretcher') !== (famB === 'stretcher')) return false
  if ((famA === 'divider') !== (famB === 'divider')) return false

  // Optional strict Role Family check (merges Left+Right Side Panels, Twin Shelves, Twin Dividers while keeping Top & Bottom distinct)
  if (matchRoleFamily && famA !== famB) {
    return false
  }

  return true
}

/**
 * Resolves a clean unified label when symmetric or duplicate panels are merged
 * (e.g., "Left Side Panel" + "Right Side Panel" -> "Side Panel",
 *  "Shelf #1" + "Shelf #2" -> "Shelf", "Divider L" + "Divider R" -> "Vertical Divider").
 */
export function formatConsolidatedRoleName(partNames = []) {
  const unique = Array.from(
    new Set(partNames.map((n) => String(n || '').trim()).filter(Boolean))
  )
  if (unique.length === 0) return 'Cabinet Panel'
  if (unique.length === 1) return unique[0]

  const lowerList = unique.map((n) => n.toLowerCase())

  if (lowerList.every((n) => n.includes('side panel') || n === 'side')) {
    return 'Side Panel'
  }
  if (lowerList.every((n) => n.startsWith('shelf') || n.includes('shelf'))) {
    return 'Shelf'
  }
  if (lowerList.every((n) => n.includes('divider'))) {
    return 'Vertical Divider'
  }
  if (
    lowerList.every((n) => n === 'top panel' || n === 'bottom panel') &&
    lowerList.length === 2
  ) {
    return 'Top / Bottom Panel'
  }

  return unique[0]
}

/**
 * Flattens selected project schedules into an unmerged list while preserving source_jobs.
 */
export function getRawSelectedParts(selectedJobIds = ['Job #1', 'Job #2'], schedules = PROJECT_SCHEDULES) {
  const result = []
  let idx = 1
  for (const jobId of selectedJobIds) {
    const job = schedules[jobId]
    if (!job || !Array.isArray(job.parts)) continue
    for (const part of job.parts) {
      const existingUuids = Array.isArray(part.meshUuids)
        ? [...part.meshUuids]
        : part.meshUuid
        ? [part.meshUuid]
        : []
      result.push({
        ...part,
        id: part.id || idx * 1000,
        num: `#${idx}`,
        qty: Number(part.qty) || 1,
        isOrnament: Boolean(part.isOrnament),
        meshUuids: existingUuids,
        source_jobs: Array.isArray(part.source_jobs) && part.source_jobs.length > 0
          ? [...part.source_jobs]
          : [jobId],
        consolidated: Boolean(part.consolidated),
      })
      idx += 1
    }
  }
  return result
}

/**
 * Consolidates multiple cutlist schedules or an existing array of parts using
 * dynamic fuzzy matching (`|H_a - H_b| <= 0.5 mm`, `|L_a - L_b| <= 2.0 mm`,
 * `|W_a - W_b| <= 2.0 mm` including transposed L/W, Material, and Corner).
 * Accumulates quantities, sets representative dimensions `Math.max(L_a, L_b)`,
 * and preserves all constituent 3D mesh UUIDs in `consolidatedPart.meshUuids`.
 *
 * @param {Array} partsList - Array of raw part objects from one or more jobs or 3D meshes
 * @param {Object} options - `{ requireStrictCorner: boolean }`
 * @returns {Object} `{ parts, stats }`
 */
export function aggregateProjectCutlists(partsList = [], options = {}) {
  const requireStrictCorner = options.requireStrictCorner ?? false
  const matchRoleFamily = options.matchRoleFamily ?? false
  const groups = []

  for (const item of partsList) {
    const rawL = Number(item.l) || 0
    const rawW = Number(item.w) || 0
    const normL = Math.max(rawL, rawW)
    const normW = Math.min(rawL, rawW)
    const normH = Number(item.h) || 0
    const itemQty = Number(item.qty) || 1

    const itemJobs =
      Array.isArray(item.source_jobs) && item.source_jobs.length > 0
        ? item.source_jobs
        : item.sourceJob
        ? [item.sourceJob]
        : ['Job #1']

    const itemUuids = Array.isArray(item.meshUuids)
      ? item.meshUuids.filter(Boolean)
      : item.meshUuid
      ? [item.meshUuid]
      : []

    const itemPanelIndices = Array.isArray(item.panelIndices)
      ? item.panelIndices
      : typeof item.panelIndex === 'number'
      ? [item.panelIndex]
      : []

    const normalizedCandidate = {
      ...item,
      l: normL,
      w: normW,
      h: normH,
    }

    const matchedGroup = groups.find((g) =>
      arePartsNearIdentical(g, normalizedCandidate, {
        requireStrictCorner,
        matchRoleFamily,
      })
    )

    if (!matchedGroup) {
      groups.push({
        ...item,
        l: normL,
        w: normW,
        h: normH,
        qty: itemQty,
        isOrnament: Boolean(item.isOrnament),
        mergedCount: 1,
        source_jobs: Array.from(new Set(itemJobs)),
        partNames: [item.part || item.panelRole || 'Cabinet Panel'],
        meshUuids: Array.from(new Set(itemUuids)),
        panelIndices: Array.from(new Set(itemPanelIndices)),
      })
    } else {
      matchedGroup.qty += itemQty
      matchedGroup.mergedCount += 1
      matchedGroup.isOrnament = Boolean(matchedGroup.isOrnament || item.isOrnament)
      matchedGroup.l = Math.max(matchedGroup.l, normL)
      matchedGroup.w = Math.max(matchedGroup.w, normW)
      matchedGroup.h = Math.max(matchedGroup.h, normH)

      for (const j of itemJobs) {
        if (!matchedGroup.source_jobs.includes(j)) {
          matchedGroup.source_jobs.push(j)
        }
      }
      if (item.part && !matchedGroup.partNames.includes(item.part)) {
        matchedGroup.partNames.push(item.part)
      }
      for (const uuid of itemUuids) {
        if (!matchedGroup.meshUuids.includes(uuid)) {
          matchedGroup.meshUuids.push(uuid)
        }
      }
      for (const pIdx of itemPanelIndices) {
        if (!matchedGroup.panelIndices.includes(pIdx)) {
          matchedGroup.panelIndices.push(pIdx)
        }
      }
      if (matchedGroup.corner === 'None' && item.corner && item.corner !== 'None') {
        matchedGroup.corner = item.corner
      }
    }
  }

  const consolidatedParts = groups.map((entry, index) => {
    const isConsolidated =
      entry.mergedCount > 1 || entry.source_jobs.length > 1 || entry.qty > 1
    const unifiedName = formatConsolidatedRoleName(entry.partNames)
    const meshUuids = Array.isArray(entry.meshUuids) ? entry.meshUuids : []
    const syncedQty = meshUuids.length > 0 ? meshUuids.length : entry.qty
    return {
      ...entry,
      id: entry.id || index + 1,
      num: `#${index + 1}`,
      part: unifiedName,
      panelRole: unifiedName,
      qty: syncedQty,
      isOrnament: Boolean(entry.isOrnament),
      meshUuids,
      panelIndices: entry.panelIndices || [],
      consolidated: isConsolidated,
    }
  })

  const totalRawRows = partsList.length
  const totalConsolidatedRows = consolidatedParts.length
  const totalPieces = consolidatedParts.reduce((acc, p) => acc + (Number(p.qty) || 1), 0)

  return {
    parts: consolidatedParts,
    stats: {
      totalRawRows,
      totalConsolidatedRows,
      duplicateRowsEliminated: Math.max(0, totalRawRows - totalConsolidatedRows),
      totalPieces,
    },
  }
}

/**
 * Dedicated "Table Saw Rip Sorter":
 * 1. Groups parts by Material and Thickness (e.g., "18mm Marine Plywood · 18mm").
 * 2. Sorts parts descending by Width (W ↓) then Length (L ↓) so carpenters
 *    can make repetitive rip cuts without moving the table saw fence.
 *
 * @param {Array} partsList - Array of cutlist parts
 * @returns {Object} `{ parts, fenceSetupsCount }`
 */
export function sortPartsForRipCuts(partsList = []) {
  const cloned = partsList.map((p) => ({
    ...p,
    l: Number(p.l) || 0,
    w: Number(p.w) || 0,
    h: Number(p.h) || 0,
    qty: Number(p.qty) || 1,
    meshUuids: Array.isArray(p.meshUuids) ? [...p.meshUuids] : [],
    panelIndices: Array.isArray(p.panelIndices) ? [...p.panelIndices] : [],
  }))

  cloned.sort((a, b) => {
    const matA = String(a.material || '').trim().toLowerCase()
    const matB = String(b.material || '').trim().toLowerCase()
    if (matA !== matB) return matA.localeCompare(matB)

    if (b.h !== a.h) return b.h - a.h
    if (b.w !== a.w) return b.w - a.w
    return b.l - a.l
  })

  const uniqueFenceSetups = new Set()
  const reindexed = cloned.map((item, idx) => {
    const setupKey = `${String(item.material).toLowerCase()}::${item.h}mm::W${item.w}`
    uniqueFenceSetups.add(setupKey)
    return {
      ...item,
      num: `#${idx + 1}`,
      ripSetupGroup: `${item.material} (${item.h}mm) · Fence W=${item.w}mm`,
      isRipSorted: true,
    }
  })

  return {
    parts: reindexed,
    fenceSetupsCount: uniqueFenceSetups.size,
  }
}
