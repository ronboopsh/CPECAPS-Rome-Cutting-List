/**
 * ============================================================================
 * MODULE 1: MULTI-PROJECT CUTLIST AGGREGATOR & SAW-SETUP RIP SORTER
 * Rome Cabinets - Automated Cutting List & Shop-Floor Coordinator
 * ============================================================================
 */

export const PROJECT_SCHEDULES = {
  'Job #1': {
    id: 'Job #1',
    shortLabel: 'Job 1 (Kitchen)',
    fullName: 'Job #1: Galvez Kitchen',
    client: 'Galvez Residence',
    parts: [
      { id: 101, num: '#1', part: 'Side Panel', qty: 2, l: 750, w: 500, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
      { id: 102, num: '#2', part: 'Base Shelf', qty: 2, l: 564, w: 480, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
      { id: 103, num: '#3', part: 'Adjustable Shelf', qty: 1, l: 564, w: 480, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
      { id: 104, num: '#4', part: 'Top Stretcher', qty: 2, l: 564, w: 100, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #1'] },
      { id: 105, num: '#5', part: 'Cabinet Door Slab', qty: 2, l: 746, w: 296, h: 18, corner: 'Edge 2x', material: 'MDF', source_jobs: ['Job #1'] },
      { id: 106, num: '#6', part: 'Top Panel', qty: 1, l: 600, w: 500, h: 18, corner: 'Edge 1x', material: 'MDF', source_jobs: ['Job #1'] },
    ],
  },
  'Job #2': {
    id: 'Job #2',
    shortLabel: 'Job 2 (Wardrobe)',
    fullName: 'Job #2: Wardrobe Unit',
    client: 'Master Suite Fit-Out',
    parts: [
      { id: 201, num: '#7', part: 'Side Panel', qty: 2, l: 750, w: 500, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
      { id: 202, num: '#8', part: 'Wardrobe Tall Gable', qty: 2, l: 2100, w: 600, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
      { id: 203, num: '#9', part: 'Fixed Shelf', qty: 3, l: 564, w: 480, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
      { id: 204, num: '#10', part: 'Top Panel', qty: 2, l: 600, w: 500, h: 18, corner: 'Edge 1x', material: 'MDF', source_jobs: ['Job #2'] },
      { id: 205, num: '#11', part: 'Valance Rail', qty: 2, l: 864, w: 100, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #2'] },
    ],
  },
  'Job #3': {
    id: 'Job #3',
    shortLabel: 'Job 3 (Drawer Bank)',
    fullName: 'Job #3: Drawer Bank',
    client: 'Workshop Island Unit',
    parts: [
      { id: 301, num: '#12', part: 'Side Panel', qty: 2, l: 750, w: 500, h: 18, corner: 'Edge 1x', material: '18mm Marine Plywood', source_jobs: ['Job #3'] },
      { id: 302, num: '#13', part: 'Drawer Box Side', qty: 6, l: 450, w: 160, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #3'] },
      { id: 303, num: '#14', part: 'Drawer Front Face', qty: 3, l: 746, w: 296, h: 18, corner: 'Edge 2x', material: 'MDF', source_jobs: ['Job #3'] },
      { id: 304, num: '#15', part: 'Stretcher Rail', qty: 4, l: 564, w: 100, h: 18, corner: 'None', material: '18mm Marine Plywood', source_jobs: ['Job #3'] },
    ],
  },
}

/**
 * Generates a normalized composite signature key for matching identical parts
 * across multiple project schedules: (material, thickness H, width W, length L).
 */
export function getPartIdentityKey(part) {
  const mat = String(part.material || 'MDF').trim().toLowerCase()
  const h = Number(part.h) || 0
  const w = Number(part.w) || 0
  const l = Number(part.l) || 0
  return `${mat}::h=${h}::w=${w}::l=${l}`
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
      result.push({
        ...part,
        id: part.id || idx * 1000,
        num: `#${idx}`,
        qty: Number(part.qty) || 1,
        source_jobs: Array.isArray(part.source_jobs) && part.source_jobs.length > 0
          ? [...part.source_jobs]
          : [jobId],
        consolidated: false,
      })
      idx += 1
    }
  }
  return result
}

/**
 * Consolidates multiple cutlist schedules or an existing array of parts.
 * Detects identical parts (matching Material, Thickness H, Width W, Length L),
 * sums their quantities, and merges `source_jobs` metadata.
 *
 * @param {Array} partsList - Array of raw part objects from one or more jobs
 * @returns {Object} { parts, stats }
 */
export function aggregateProjectCutlists(partsList = []) {
  const groupedMap = new Map()

  for (const item of partsList) {
    const key = getPartIdentityKey(item)
    const itemQty = Number(item.qty) || 1
    const itemJobs = Array.isArray(item.source_jobs) && item.source_jobs.length > 0
      ? item.source_jobs
      : item.sourceJob
      ? [item.sourceJob]
      : ['Job #1']

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        ...item,
        l: Number(item.l) || 0,
        w: Number(item.w) || 0,
        h: Number(item.h) || 0,
        qty: itemQty,
        mergedCount: 1,
        source_jobs: Array.from(new Set(itemJobs)),
        partNames: [item.part],
      })
    } else {
      const existing = groupedMap.get(key)
      existing.qty += itemQty
      existing.mergedCount += 1
      for (const j of itemJobs) {
        if (!existing.source_jobs.includes(j)) {
          existing.source_jobs.push(j)
        }
      }
      if (item.part && !existing.partNames.includes(item.part)) {
        existing.partNames.push(item.part)
      }
      // Prefer more descriptive edge banding specification if merged
      if (existing.corner === 'None' && item.corner && item.corner !== 'None') {
        existing.corner = item.corner
      }
    }
  }

  const consolidatedParts = Array.from(groupedMap.values()).map((entry, index) => {
    const isConsolidated = entry.mergedCount > 1 || entry.source_jobs.length > 1
    return {
      ...entry,
      id: entry.id || index + 1,
      num: `#${index + 1}`,
      part: entry.partNames[0],
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
 * @returns {Object} { parts, fenceSetupsCount, ripGroups }
 */
export function sortPartsForRipCuts(partsList = []) {
  const cloned = partsList.map((p) => ({
    ...p,
    l: Number(p.l) || 0,
    w: Number(p.w) || 0,
    h: Number(p.h) || 0,
    qty: Number(p.qty) || 1,
  }))

  cloned.sort((a, b) => {
    // 1. Group by Material (alphabetical, keeping same sheets together)
    const matA = String(a.material || '').trim().toLowerCase()
    const matB = String(b.material || '').trim().toLowerCase()
    if (matA !== matB) return matA.localeCompare(matB)

    // 2. Group by Thickness H descending
    if (b.h !== a.h) return b.h - a.h

    // 3. Sort descending by Width (W ↓) for continuous table saw fence settings
    if (b.w !== a.w) return b.w - a.w

    // 4. Sort descending by Length (L ↓) for crosscut efficiency
    return b.l - a.l
  })

  // Track unique table-saw fence setups (Material + Thickness + Width W)
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
