import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X, Printer, FileDown, Layers } from 'lucide-react'
import { MEASUREMENT_UNITS, normalizeUnitCode } from '../utils/exporter'
import { disambiguateCutlistPartName, isAmbiguousCadName } from '../utils/panelClassifier'

const SORTABLE_COLUMNS = [
  { key: 'num', label: '#', type: 'numeric', className: 'py-2.5 pl-3 pr-2 w-12' },
  { key: 'part', label: 'PART & SOURCE JOBS', type: 'alpha', className: 'py-2.5 px-2.5' },
  { key: 'qty', label: 'QTY', type: 'numeric', className: 'py-2.5 px-2 w-16 text-center' },
  { key: 'l', label: 'L', type: 'numeric', className: 'py-2.5 px-2 w-16 text-right' },
  { key: 'w', label: 'W', type: 'numeric', className: 'py-2.5 px-2 w-16 text-right' },
  { key: 'h', label: 'H', type: 'numeric', className: 'py-2.5 px-2 w-14 text-right' },
  { key: 'corner', label: 'CORNER', type: 'alpha', className: 'py-2.5 px-2.5 w-24' },
  { key: 'material', label: 'MATERIAL', type: 'alpha', className: 'py-2.5 px-2.5' },
]

/**
 * Master Interactive Cutting List Table (`src/components/CuttingListTable.jsx`)
 * Owner: Rene De Jesus
 * Expanded Center Column workspace table with full vertical height, clean top
 * toolbar, monospace numeric dimensions, column sorting, and two-way 3D/2D sync.
 */
export default function CuttingListTable({
  parts,
  totalPiecesCount,
  activeProjectLabel,
  selectedJobsCount = 1,
  isConsolidated = false,
  isRipSorted = false,
  unit,
  onSetUnit,
  selectedId,
  editingId,
  editDraft,
  formatDim,
  onRowClick,
  onStartEditing,
  onChangeEditDraft,
  onSaveEdit,
  onCancelEdit,
  onDeleteRow,
  onAddPart,
  onExportCsv,
  onExportPdf,
}) {
  const activeUnit = normalizeUnitCode(unit)
  // Default to Width descending ('w' ↓) to support table-saw rip-cut workflow
  const [sortConfig, setSortConfig] = useState({ key: 'w', direction: 'desc' })

  // Preserve exact Material -> H -> Width ↓ rip sequence when Rip Sort is activated
  useEffect(() => {
    if (isRipSorted) {
      setSortConfig({ key: null, direction: 'desc' })
    }
  }, [isRipSorted])

  const handleHeaderSort = (columnKey) => {
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      const defaultDir =
        columnKey === 'l' || columnKey === 'w' || columnKey === 'h' || columnKey === 'qty'
          ? 'desc'
          : 'asc'
      return { key: columnKey, direction: defaultDir }
    })
  }

  const sortedParts = useMemo(() => {
    if (!Array.isArray(parts) || parts.length === 0) return []
    const indexed = parts.map((row, originalIdx) => {
      const displayPartName =
        row.panelRole && isAmbiguousCadName(row.part)
          ? row.panelRole
          : disambiguateCutlistPartName(row.part, originalIdx)
      const parsedNum =
        parseInt(String(row.num ?? '').replace(/[^0-9]/g, ''), 10) || originalIdx + 1
      const cornerLabel = String(
        row.corner || (row.isOrnament ? 'Custom' : 'None')
      ).trim()
      const materialLabel = String(
        row.material || (row.isOrnament ? 'Solid Wood / Custom' : '18mm Marine Plywood')
      ).trim()
      return {
        row,
        originalIdx,
        displayPartName,
        parsedNum,
        cornerLabel,
        materialLabel,
      }
    })

    const { key, direction } = sortConfig
    if (!key) return indexed

    const dirMultiplier = direction === 'asc' ? 1 : -1

    indexed.sort((a, b) => {
      let cmp = 0
      switch (key) {
        case 'num':
          cmp = a.parsedNum - b.parsedNum
          break
        case 'qty':
          cmp = (Number(a.row.qty) || 1) - (Number(b.row.qty) || 1)
          break
        case 'l':
          cmp = (Number(a.row.l) || 0) - (Number(b.row.l) || 0)
          if (cmp === 0) cmp = (Number(a.row.w) || 0) - (Number(b.row.w) || 0)
          break
        case 'w':
          cmp = (Number(a.row.w) || 0) - (Number(b.row.w) || 0)
          if (cmp === 0) cmp = (Number(a.row.l) || 0) - (Number(b.row.l) || 0)
          break
        case 'h':
          cmp = (Number(a.row.h) || 0) - (Number(b.row.h) || 0)
          break
        case 'part':
          cmp = a.displayPartName.localeCompare(b.displayPartName, undefined, {
            sensitivity: 'base',
            numeric: true,
          })
          break
        case 'corner':
          cmp = a.cornerLabel.localeCompare(b.cornerLabel, undefined, {
            sensitivity: 'base',
            numeric: true,
          })
          break
        case 'material':
          cmp = a.materialLabel.localeCompare(b.materialLabel, undefined, {
            sensitivity: 'base',
            numeric: true,
          })
          break
        default:
          cmp = 0
      }

      if (cmp !== 0) return cmp * dirMultiplier
      return a.originalIdx - b.originalIdx
    })

    return indexed
  }, [parts, sortConfig])

  const contextTitle = isConsolidated
    ? `Consolidated (${selectedJobsCount} ${selectedJobsCount === 1 ? 'Job' : 'Jobs'})`
    : selectedJobsCount > 1
    ? `${selectedJobsCount} Active Jobs`
    : activeProjectLabel || 'Cutting List'

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 h-full lg:max-h-[max(736px,calc(100vh-142px))] flex flex-col flex-1 transition-colors">
      {/* Single Compact Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-gray-100 dark:border-zinc-800 px-1">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <h2 className="text-[15.5px] font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Cutting List
          </h2>

          {/* Active Project / Consolidated Mode Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border ${
              isConsolidated
                ? 'bg-[#FACC15] text-zinc-950 border-[#EAB308]'
                : 'bg-[#111827] dark:bg-zinc-800 text-[#FACC15] border-zinc-700'
            }`}
          >
            {contextTitle}
          </span>

          {isRipSorted && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">
              RIP W ↓
            </span>
          )}

          {/* Monospace Summary + Interactive Unit Dropdown */}
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
            <span>
              {parts.length} {parts.length === 1 ? 'row' : 'rows'} · {totalPiecesCount} pcs
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <select
              aria-label="Cutting List measurement unit"
              value={activeUnit}
              onChange={(e) => onSetUnit?.(e.target.value)}
              className="px-1.5 py-0.5 text-[11.5px] font-mono font-extrabold text-zinc-900 dark:text-[#FACC15] bg-zinc-100 dark:bg-zinc-800 hover:bg-[#FACC15]/40 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 focus:border-[#EAB308] rounded-md focus:outline-none cursor-pointer transition-colors"
            >
              {MEASUREMENT_UNITS.map((u) => (
                <option
                  key={u.value}
                  value={u.value}
                  className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {u.value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Toolbar Actions: Export + Primary Yellow "+ Add Part" CTA */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onExportPdf}
            title="Print ISO Shop Cut Sheet (PDF)"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent dark:border-zinc-700 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">PDF</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            title="Export Excel / CSV Cutlist"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent dark:border-zinc-700 px-2 py-1.5 rounded-lg transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={onAddPart}
            className="inline-flex items-center gap-1 text-xs font-extrabold text-zinc-950 bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.6]" />
            <span>Add Part</span>
          </button>
        </div>
      </div>

      {/* Expanded Master Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {SORTABLE_COLUMNS.map((col) => {
                const isActiveSort = sortConfig.key === col.key
                const arrowSymbol = sortConfig.direction === 'asc' ? '↑' : '↓'
                const isRightAligned = col.className.includes('text-right')
                const isCenterAligned = col.className.includes('text-center')
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      isActiveSort
                        ? sortConfig.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleHeaderSort(col.key)}
                    className={`${col.className} cursor-pointer select-none rounded-t-md transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-[#FACC15] ${
                      isActiveSort ? 'text-zinc-900 dark:text-[#FACC15]' : ''
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${
                        isRightAligned
                          ? 'justify-end'
                          : isCenterAligned
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      <span>{col.label}</span>
                      {isActiveSort && (
                        <span className="text-zinc-900 dark:text-[#FACC15] font-extrabold">
                          {arrowSymbol}
                        </span>
                      )}
                    </span>
                  </th>
                )
              })}
              <th className="py-2.5 pl-2 pr-3 text-right w-20 select-none">
                ACTIONS
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/90 text-[13px]">
            {sortedParts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 px-6 text-center">
                  <div className="mx-auto max-w-sm flex flex-col items-center gap-2.5">
                    <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-zinc-400 dark:text-[#FACC15]/70" />
                    </div>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      No parts loaded in the active Cutting List
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Select a project in the left sidebar, upload a 3D CAD / OCR
                      sheet, or click <span className="font-bold text-zinc-900 dark:text-[#FACC15]">+ Add Part</span> to begin.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedParts.map(({ row, displayPartName }) => {
                const isSelected = row.id === selectedId
                const isEditing = row.id === editingId
                const qtyVal = Number(row.qty) || 1
                const sourceJobs =
                  Array.isArray(row.source_jobs) && row.source_jobs.length > 0
                    ? row.source_jobs
                    : ['Job #1']
                const isMultiJob =
                  row.consolidated ||
                  sourceJobs.length > 1 ||
                  (Array.isArray(row.meshUuids) && row.meshUuids.length > 1)

                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.id, row)}
                    className={`group cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-yellow-50/90 dark:bg-[#FACC15]/15 hover:bg-yellow-100/80 dark:hover:bg-[#FACC15]/20 border-l-4 border-l-[#FACC15]'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* # Badge */}
                    <td className="py-2.5 pl-3 pr-2 font-mono font-medium">
                      <span
                        className={`inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'text-zinc-950 bg-[#FACC15]'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {row.num}
                      </span>
                    </td>

                    {/* PART + CONSOLIDATED SOURCE JOB BADGES */}
                    <td className="py-2.5 px-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft.part}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onChangeEditDraft({ ...editDraft, part: e.target.value })
                          }
                          className="w-36 px-2 py-1 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                        />
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{displayPartName}</span>
                          {row.isOrnament && (
                            <span className="bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-500/50 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                              ORNAMENT
                            </span>
                          )}
                          {isMultiJob && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#FACC15] text-zinc-950 border border-[#EAB308]">
                              MERGED ×{qtyVal}
                            </span>
                          )}
                          {sourceJobs.map((jobTag) => (
                            <span
                              key={jobTag}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                jobTag === 'OCR Scan'
                                  ? 'bg-[#111827] dark:bg-zinc-950 text-[#FACC15] border border-zinc-700'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700'
                              }`}
                            >
                              {jobTag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* QTY */}
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={editDraft.qty}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onChangeEditDraft({ ...editDraft, qty: e.target.value })
                          }
                          className="w-14 px-1.5 py-1 text-xs text-center font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                        />
                      ) : (
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-extrabold ${
                            isMultiJob
                              ? 'bg-[#111827] dark:bg-zinc-950 text-[#FACC15]'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          ×{qtyVal}
                        </span>
                      )}
                    </td>

                    {/* L */}
                    <td className="py-2.5 px-2 text-right font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editDraft.l}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onChangeEditDraft({ ...editDraft, l: e.target.value })
                          }
                          className="w-16 px-1.5 py-1 text-xs text-right font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                        />
                      ) : (
                        formatDim(row.l)
                      )}
                    </td>

                    {/* W */}
                    <td className="py-2.5 px-2 text-right font-mono text-zinc-900 dark:text-zinc-100 font-bold tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editDraft.w}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onChangeEditDraft({ ...editDraft, w: e.target.value })
                          }
                          className="w-16 px-1.5 py-1 text-xs text-right font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                        />
                      ) : (
                        <span
                          className={
                            isRipSorted
                              ? 'bg-yellow-100/90 dark:bg-[#FACC15]/20 text-zinc-950 dark:text-[#FACC15] px-1.5 py-0.5 rounded border border-[#EAB308]'
                              : ''
                          }
                        >
                          {formatDim(row.w)}
                        </span>
                      )}
                    </td>

                    {/* H */}
                    <td className="py-2.5 px-2 text-right font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editDraft.h}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onChangeEditDraft({ ...editDraft, h: e.target.value })
                          }
                          className="w-14 px-1.5 py-1 text-xs text-right font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                        />
                      ) : (
                        formatDim(row.h)
                      )}
                    </td>

                    {/* CORNER */}
                    <td className="py-2.5 px-2.5 text-zinc-600 dark:text-zinc-400">
                      {isEditing ? (
                        <select
                          value={editDraft.corner}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onChangeEditDraft({ ...editDraft, corner: e.target.value })
                          }
                          className="px-1.5 py-1 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                        >
                          <option value="None">None</option>
                          <option value="Edge 1x">Edge 1x</option>
                          <option value="Edge 2x">Edge 2x</option>
                          <option value="Edge 4x">Edge 4x</option>
                          <option value="Notch">Notch</option>
                          <option value="Chamfer">Chamfer</option>
                          <option value="Custom">Custom</option>
                        </select>
                      ) : (
                        <span
                          className={
                            row.corner === 'None'
                              ? 'text-zinc-500 dark:text-zinc-500'
                              : 'text-zinc-800 dark:text-zinc-200 font-medium'
                          }
                        >
                          {row.corner || (row.isOrnament ? 'Custom' : 'None')}
                        </span>
                      )}
                    </td>

                    {/* MATERIAL */}
                    <td className="py-2.5 px-2.5 text-zinc-800 dark:text-zinc-200 font-medium">
                      {isEditing ? (
                        <select
                          value={editDraft.material}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onChangeEditDraft({
                              ...editDraft,
                              material: e.target.value,
                            })
                          }
                          className="px-1.5 py-1 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                        >
                          <option value="18mm Marine Plywood">
                            18mm Marine Plywood
                          </option>
                          <option value="MDF">MDF</option>
                          <option value="Plywood">Plywood</option>
                          <option value="Oak Veneer">Oak Veneer</option>
                          <option value="Solid Wood / Custom">
                            Solid Wood / Custom
                          </option>
                        </select>
                      ) : (
                        row.material ||
                        (row.isOrnament ? 'Solid Wood / Custom' : '18mm Marine Plywood')
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="py-2.5 pl-2 pr-3 text-right">
                      {isEditing ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Save changes"
                            onClick={onSaveEdit}
                            className="p-1.5 rounded-md bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            onClick={onCancelEdit}
                            className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1 text-zinc-700 dark:text-zinc-300">
                          <button
                            type="button"
                            title="Edit row"
                            onClick={(e) => onStartEditing(e, row)}
                            className="p-1.5 rounded-md text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete row"
                            onClick={(e) => onDeleteRow(e, row)}
                            className="p-1.5 rounded-md text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
