import React from 'react'
import { Ruler } from 'lucide-react'
import { formatDimensionByUnit, normalizeUnitCode } from '../utils/exporter'

/**
 * 2D Part Blueprint & Spec Inspector (`src/components/PartBlueprintInspector.jsx`)
 * Pure React + SVG orthographic drafting inspector anchored directly beneath
 * `<CabinetWireframe />` in the Right Column.
 *
 * Features:
 *  - Full-bleed architectural drafting grid canvas with L-shaped yellow corner brackets
 *  - Large proportional 2D orthographic rectangle (clamped for extreme aspect ratios)
 *  - Architectural dimension extension lines with arrow ticks for L & W in active unit
 *  - Side-edge thickness callout bar showing H (`T: 18 mm`)
 *  - Edge-banding highlights (`Edge 1x/2x/3x/4x`) in bold `#FACC15` + Notch/Chamfer markers
 *  - Ornament bounding-box dashed amber mode (`ORNAMENT · MIN BOUNDING BOX`)
 *  - Compact monospace spec strip (`QTY`, `AREA`, `MATERIAL`)
 */

function parseCornerSpec(cornerStr = '') {
  const raw = String(cornerStr || '').trim()
  const lower = raw.toLowerCase()

  let edgeBandCount = 0
  if (lower.includes('edge 4') || lower.includes('4x') || lower.includes('all edge')) {
    edgeBandCount = 4
  } else if (lower.includes('edge 3') || lower.includes('3x')) {
    edgeBandCount = 3
  } else if (lower.includes('edge 2') || lower.includes('2x')) {
    edgeBandCount = 2
  } else if (lower.includes('edge 1') || lower.includes('1x') || lower.includes('edge')) {
    edgeBandCount = 1
  }

  const hasNotch = lower.includes('notch') || lower.includes('cutout')
  const hasChamfer =
    lower.includes('chamfer') || lower.includes('bevel') || lower.includes('miter')
  const isCustom =
    !edgeBandCount && !hasNotch && !hasChamfer && lower !== '' && lower !== 'none'

  return { raw, edgeBandCount, hasNotch, hasChamfer, isCustom }
}

function formatArea(lMm, wMm, unit) {
  const code = normalizeUnitCode(unit)
  const areaMm2 = Math.max(0, (Number(lMm) || 0) * (Number(wMm) || 0))
  if (code === 'in' || code === 'ft') {
    const sqFt = areaMm2 / (304.8 * 304.8)
    return `${sqFt.toFixed(2)} ft²`
  }
  const sqM = areaMm2 / 1_000_000
  return `${sqM.toFixed(3)} m²`
}

export default function PartBlueprintInspector({ selectedPart, unit = 'mm' }) {
  const activeUnit = normalizeUnitCode(unit)

  const partLength = Math.max(1, Number(selectedPart?.l) || 0)
  const partWidth = Math.max(1, Number(selectedPart?.w) || 0)
  const partThickness = Math.max(1, Number(selectedPart?.h) || 18)
  const partQty = Math.max(1, Number(selectedPart?.qty) || 1)
  const isOrnament = Boolean(selectedPart?.isOrnament)
  const cornerSpec = parseCornerSpec(selectedPart?.corner)

  // Expanded SVG Blueprint geometry layout (viewBox 420 x 236 fills card cleanly edge-to-edge)
  const VB_W = 420
  const VB_H = 236
  const MAX_RECT_W = 244
  const MAX_RECT_H = 114
  const MIN_RECT_W = 72
  const MIN_RECT_H = 40

  // Compute proportional box with safe aspect clamping so slender stretchers stay legible
  const rawRatio = partLength / partWidth
  const clampedRatio = Math.min(3.8, Math.max(0.42, rawRatio))

  let rectW = MAX_RECT_W
  let rectH = rectW / clampedRatio
  if (rectH > MAX_RECT_H) {
    rectH = MAX_RECT_H
    rectW = rectH * clampedRatio
  }
  rectW = Math.max(MIN_RECT_W, Math.min(MAX_RECT_W, rectW))
  rectH = Math.max(MIN_RECT_H, Math.min(MAX_RECT_H, rectH))

  // Center the orthographic panel inside the drawing area (leaving room for top L dim, right W dim, bottom H bar)
  const rectX = Math.round((VB_W - 76 - rectW) / 2) + 8
  const rectY = Math.round(46 + (MAX_RECT_H - rectH) / 2)

  // Notch / Chamfer cutaway path on top-right corner
  const cutSize = Math.min(18, Math.max(10, Math.min(rectW, rectH) * 0.25))
  const buildPanelPath = () => {
    const x1 = rectX
    const y1 = rectY
    const x2 = rectX + rectW
    const y2 = rectY + rectH

    if (cornerSpec.hasNotch) {
      return `M ${x1} ${y1} L ${x2 - cutSize} ${y1} L ${x2 - cutSize} ${y1 + cutSize} L ${x2} ${y1 + cutSize} L ${x2} ${y2} L ${x1} ${y2} Z`
    }
    if (cornerSpec.hasChamfer) {
      return `M ${x1} ${y1} L ${x2 - cutSize} ${y1} L ${x2} ${y1 + cutSize} L ${x2} ${y2} L ${x1} ${y2} Z`
    }
    return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`
  }

  // Side-edge thickness profile bar below the orthographic panel
  const thickBarY = 194
  const thickBarH = Math.min(12, Math.max(6, Math.round((partThickness / 25) * 9)))
  const thickBarW = Math.min(rectW, 156)
  const thickBarX = rectX + (rectW - thickBarW) / 2

  const fmtL = `${formatDimensionByUnit(partLength, activeUnit)} ${activeUnit}`
  const fmtW = `${formatDimensionByUnit(partWidth, activeUnit)} ${activeUnit}`
  const fmtH = `${formatDimensionByUnit(partThickness, activeUnit)} ${activeUnit}`
  const areaLabel = formatArea(partLength, partWidth, activeUnit)

  const displayName =
    selectedPart?.part || selectedPart?.panelRole || selectedPart?.part_name || ''

  const materialLabel =
    selectedPart?.material ||
    (isOrnament ? 'Solid Wood / Custom' : '18mm Marine Plywood')

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-3 flex flex-col flex-1 min-h-0 transition-colors">
      {/* Clean Header Bar */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="w-6 h-6 rounded-md bg-[#111827] dark:bg-zinc-800 flex items-center justify-center border border-transparent dark:border-zinc-700 shrink-0">
          <Ruler className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.2]" />
        </div>
        <h2 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
          2D Part Blueprint
        </h2>
      </div>

      {/* Blueprint Canvas Container */}
      {!selectedPart ? (
        /* Empty State: Architectural Drafting Grid + L-Shaped Yellow Corner Brackets */
        <div className="relative flex-1 min-h-[210px] rounded-xl border border-gray-200 dark:border-zinc-800 bg-[#F8F7F2] dark:bg-[#0B0D11] overflow-hidden flex items-center justify-center p-5 text-center transition-colors">
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-60 dark:opacity-45"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="blueprint-empty-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  className="text-zinc-300 dark:text-zinc-800"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#blueprint-empty-grid)" />
          </svg>

          {/* Technical L-shaped yellow corner brackets */}
          <span className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#FACC15]" />
          <span className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#FACC15]" />
          <span className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#FACC15]" />
          <span className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#FACC15]" />

          <div className="relative z-10 max-w-[245px] space-y-2">
            <div className="mx-auto w-9 h-9 rounded-lg bg-[#111827] dark:bg-zinc-900 border border-zinc-700 flex items-center justify-center">
              <Ruler className="w-4 h-4 text-[#FACC15]" />
            </div>
            <p className="text-[11.5px] font-semibold leading-relaxed text-zinc-600 dark:text-zinc-400">
              Select a row in the Cutting List or click a 3D panel to inspect its
              2D cut blueprint.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          {/* Enlarged Live 2D Orthographic SVG Canvas */}
          <div className="relative flex-1 min-h-[190px] max-h-[216px] rounded-xl border border-gray-200 dark:border-zinc-800 bg-[#F8F7F2] dark:bg-[#0B0D11] overflow-hidden flex items-center justify-center transition-colors">
            {/* Full-bleed background drafting grid */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="bp-bg-grid-minor"
                  width="14"
                  height="14"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 14 0 L 0 0 0 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-zinc-300/70 dark:text-zinc-800/80"
                  />
                </pattern>
                <pattern
                  id="bp-bg-grid-major"
                  width="70"
                  height="70"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="70" height="70" fill="url(#bp-bg-grid-minor)" />
                  <path
                    d="M 70 0 L 0 0 0 70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.9"
                    className="text-zinc-300 dark:text-zinc-800"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#bp-bg-grid-major)" />
            </svg>

            {/* Full-bleed technical corner registration ticks */}
            <span className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[#FACC15] pointer-events-none" />
            <span className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[#FACC15] pointer-events-none" />
            <span className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[#FACC15] pointer-events-none" />
            <span className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[#FACC15] pointer-events-none" />

            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="xMidYMid meet"
              className="relative z-10 w-full h-full block select-none"
              role="img"
              aria-label={`2D blueprint for ${displayName}: ${fmtL} by ${fmtW} by ${fmtH}`}
            >
              <defs>
                {/* Diagonal Technical Hatch for Thickness Cross-Section */}
                <pattern
                  id="bp-thickness-hatch"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="#EAB308"
                    strokeWidth="1.2"
                    strokeOpacity="0.65"
                  />
                </pattern>

                {/* Dimension Arrowhead Markers */}
                <marker
                  id="bp-arrow-start"
                  viewBox="0 0 10 10"
                  refX="1"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 9 2 L 1 5 L 9 8 z" fill="#EAB308" />
                </marker>
                <marker
                  id="bp-arrow-end"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 1 2 L 9 5 L 1 8 z" fill="#EAB308" />
                </marker>
              </defs>

              {/* TOP DIMENSION LINE — LENGTH (L) */}
              <g>
                <line
                  x1={rectX}
                  y1={rectY - 5}
                  x2={rectX}
                  y2={rectY - 25}
                  stroke="currentColor"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                  className="text-zinc-500 dark:text-zinc-500"
                />
                <line
                  x1={rectX + rectW}
                  y1={rectY - 5}
                  x2={rectX + rectW}
                  y2={rectY - 25}
                  stroke="currentColor"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                  className="text-zinc-500 dark:text-zinc-500"
                />
                <line
                  x1={rectX + 1}
                  y1={rectY - 18}
                  x2={rectX + rectW - 1}
                  y2={rectY - 18}
                  stroke="#EAB308"
                  strokeWidth="1.3"
                  markerStart="url(#bp-arrow-start)"
                  markerEnd="url(#bp-arrow-end)"
                />
                <rect
                  x={rectX + rectW / 2 - 48}
                  y={rectY - 28}
                  width="96"
                  height="18"
                  rx="4"
                  className="fill-[#111827] dark:fill-zinc-900"
                  stroke="#EAB308"
                  strokeWidth="1"
                />
                <text
                  x={rectX + rectW / 2}
                  y={rectY - 16}
                  textAnchor="middle"
                  className="fill-[#FACC15] font-mono text-[10px] font-bold"
                >
                  L: {fmtL}
                </text>
              </g>

              {/* RIGHT DIMENSION LINE — WIDTH (W) */}
              <g>
                <line
                  x1={rectX + rectW + 5}
                  y1={rectY}
                  x2={rectX + rectW + 25}
                  y2={rectY}
                  stroke="currentColor"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                  className="text-zinc-500 dark:text-zinc-500"
                />
                <line
                  x1={rectX + rectW + 5}
                  y1={rectY + rectH}
                  x2={rectX + rectW + 25}
                  y2={rectY + rectH}
                  stroke="currentColor"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                  className="text-zinc-500 dark:text-zinc-500"
                />
                <line
                  x1={rectX + rectW + 18}
                  y1={rectY + 1}
                  x2={rectX + rectW + 18}
                  y2={rectY + rectH - 1}
                  stroke="#EAB308"
                  strokeWidth="1.3"
                  markerStart="url(#bp-arrow-start)"
                  markerEnd="url(#bp-arrow-end)"
                />
                <g
                  transform={`translate(${rectX + rectW + 25}, ${rectY + rectH / 2})`}
                >
                  <rect
                    x="0"
                    y="-9.5"
                    width="78"
                    height="19"
                    rx="4"
                    className="fill-[#111827] dark:fill-zinc-900"
                    stroke="#EAB308"
                    strokeWidth="1"
                  />
                  <text
                    x="39"
                    y="3.5"
                    textAnchor="middle"
                    className="fill-[#FACC15] font-mono text-[9.5px] font-bold"
                  >
                    W: {fmtW}
                  </text>
                </g>
              </g>

              {/* 2D ORTHOGRAPHIC PART SHAPE */}
              <path
                d={buildPanelPath()}
                className={
                  isOrnament
                    ? 'fill-amber-400/15 dark:fill-amber-500/15 stroke-amber-500'
                    : 'fill-white/95 dark:fill-zinc-900/95 stroke-zinc-800 dark:stroke-zinc-200'
                }
                strokeWidth={isOrnament ? '1.9' : '1.7'}
                strokeDasharray={isOrnament ? '6 4' : undefined}
              />

              {/* Subtle center crosshair lines inside standard panel */}
              {!isOrnament && (
                <g
                  stroke="currentColor"
                  strokeWidth="0.65"
                  strokeDasharray="4 4"
                  opacity="0.35"
                  className="text-zinc-500 dark:text-zinc-500"
                >
                  <line
                    x1={rectX + 10}
                    y1={rectY + rectH / 2}
                    x2={rectX + rectW - 10}
                    y2={rectY + rectH / 2}
                  />
                  <line
                    x1={rectX + rectW / 2}
                    y1={rectY + 10}
                    x2={rectX + rectW / 2}
                    y2={rectY + rectH - 10}
                  />
                </g>
              )}

              {/* EDGE-BANDING HIGHLIGHT LINES (Bold #FACC15 Safety Yellow) */}
              {!isOrnament && cornerSpec.edgeBandCount >= 1 && (
                <g>
                  <line
                    x1={rectX}
                    y1={rectY + rectH}
                    x2={rectX + rectW}
                    y2={rectY + rectH}
                    stroke="#FACC15"
                    strokeWidth="4.5"
                    strokeLinecap="square"
                  />
                  {cornerSpec.edgeBandCount >= 2 && (
                    <line
                      x1={rectX}
                      y1={rectY}
                      x2={
                        cornerSpec.hasNotch || cornerSpec.hasChamfer
                          ? rectX + rectW - cutSize
                          : rectX + rectW
                      }
                      y2={rectY}
                      stroke="#FACC15"
                      strokeWidth="4.5"
                      strokeLinecap="square"
                    />
                  )}
                  {cornerSpec.edgeBandCount >= 3 && (
                    <line
                      x1={rectX}
                      y1={rectY}
                      x2={rectX}
                      y2={rectY + rectH}
                      stroke="#FACC15"
                      strokeWidth="4.5"
                      strokeLinecap="square"
                    />
                  )}
                  {cornerSpec.edgeBandCount >= 4 && (
                    <line
                      x1={rectX + rectW}
                      y1={
                        cornerSpec.hasNotch || cornerSpec.hasChamfer
                          ? rectY + cutSize
                          : rectY
                      }
                      x2={rectX + rectW}
                      y2={rectY + rectH}
                      stroke="#FACC15"
                      strokeWidth="4.5"
                      strokeLinecap="square"
                    />
                  )}

                  {/* Subtle EDGE BAND callout label */}
                  <rect
                    x={rectX + rectW / 2 - 46}
                    y={rectY + rectH - 18}
                    width="92"
                    height="13.5"
                    rx="3"
                    fill="#FACC15"
                  />
                  <text
                    x={rectX + rectW / 2}
                    y={rectY + rectH - 8.2}
                    textAnchor="middle"
                    className="fill-zinc-950 font-mono text-[8px] font-extrabold tracking-wider"
                  >
                    EDGE BAND {cornerSpec.edgeBandCount}×
                  </text>
                </g>
              )}

              {/* CORNER NOTCH / CHAMFER CALLOUT MARKER */}
              {!isOrnament && (cornerSpec.hasNotch || cornerSpec.hasChamfer) && (
                <g>
                  <path
                    d={`M ${rectX + rectW - cutSize} ${rectY} L ${rectX + rectW} ${rectY} L ${rectX + rectW} ${rectY + cutSize}`}
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                  <path
                    d={
                      cornerSpec.hasNotch
                        ? `M ${rectX + rectW - cutSize} ${rectY} L ${rectX + rectW - cutSize} ${rectY + cutSize} L ${rectX + rectW} ${rectY + cutSize}`
                        : `M ${rectX + rectW - cutSize} ${rectY} L ${rectX + rectW} ${rectY + cutSize}`
                    }
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="2.5"
                  />
                  <rect
                    x={rectX + rectW - 60}
                    y={rectY + 5}
                    width="44"
                    height="13"
                    rx="2.5"
                    fill="#111827"
                    stroke="#FACC15"
                    strokeWidth="0.8"
                  />
                  <text
                    x={rectX + rectW - 38}
                    y={rectY + 14}
                    textAnchor="middle"
                    className="fill-[#FACC15] font-mono text-[8px] font-bold"
                  >
                    {cornerSpec.hasNotch ? 'NOTCH' : 'CHAMFER'}
                  </text>
                </g>
              )}

              {/* ORNAMENT STAMP INSIDE SVG */}
              {isOrnament && (
                <g>
                  <rect
                    x={rectX + rectW / 2 - 84}
                    y={rectY + rectH / 2 - 12}
                    width="168"
                    height="24"
                    rx="4"
                    fill="#111827"
                    fillOpacity="0.92"
                    stroke="#F59E0B"
                    strokeWidth="1"
                  />
                  <text
                    x={rectX + rectW / 2}
                    y={rectY + rectH / 2 + 3.5}
                    textAnchor="middle"
                    className="fill-amber-300 font-mono text-[8.5px] font-extrabold tracking-wider"
                  >
                    ORNAMENT · MIN BOUNDING BOX
                  </text>
                </g>
              )}

              {/* SIDE-EDGE THICKNESS (H) CALLOUT BAR BELOW RECTANGLE */}
              <g>
                <text
                  x={thickBarX - 8}
                  y={thickBarY + thickBarH / 2 + 3.5}
                  textAnchor="end"
                  className="fill-zinc-500 dark:fill-zinc-400 font-mono text-[9px] font-bold uppercase"
                >
                  EDGE
                </text>
                <rect
                  x={thickBarX}
                  y={thickBarY}
                  width={thickBarW}
                  height={thickBarH}
                  rx="1.5"
                  fill="url(#bp-thickness-hatch)"
                  stroke="#EAB308"
                  strokeWidth="1.2"
                />
                <rect
                  x={thickBarX + thickBarW + 8}
                  y={thickBarY + thickBarH / 2 - 9}
                  width="78"
                  height="18"
                  rx="4"
                  className="fill-[#111827] dark:fill-zinc-900"
                  stroke="#EAB308"
                  strokeWidth="1"
                />
                <text
                  x={thickBarX + thickBarW + 47}
                  y={thickBarY + thickBarH / 2 + 3.5}
                  textAnchor="middle"
                  className="fill-[#FACC15] font-mono text-[9.5px] font-bold"
                >
                  T: {fmtH}
                </text>
              </g>
            </svg>
          </div>

          {/* Clean Compact Spec Readout Strip (QTY, AREA, MATERIAL) */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px] shrink-0">
            <div className="rounded-lg bg-zinc-50 dark:bg-[#0B0D11] border border-gray-200 dark:border-zinc-800 px-2.5 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                QTY
              </span>
              <span className="font-mono font-extrabold text-zinc-900 dark:text-[#FACC15] tabular-nums">
                ×{partQty}
              </span>
            </div>

            <div className="rounded-lg bg-zinc-50 dark:bg-[#0B0D11] border border-gray-200 dark:border-zinc-800 px-2.5 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                AREA
              </span>
              <span className="font-mono font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {areaLabel}
              </span>
            </div>

            <div
              title={materialLabel}
              className="col-span-2 rounded-lg bg-zinc-50 dark:bg-[#0B0D11] border border-gray-200 dark:border-zinc-800 px-2.5 py-1.5 flex items-center justify-between gap-2 min-w-0"
            >
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0">
                MATERIAL
              </span>
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
                {materialLabel}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
