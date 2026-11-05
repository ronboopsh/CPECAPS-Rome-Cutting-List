import React from 'react'
import { Plus, Pencil, Trash2, Check, X, Printer, FileDown } from 'lucide-react'
import { MEASUREMENT_UNITS, normalizeUnitCode } from '../utils/exporter'
import { disambiguateCutlistPartName, isAmbiguousCadName } from '../utils/panelClassifier'

/**
 * Master Interactive Cutting List Table (`src/components/CuttingListTable.jsx`)
 * Owner: Rene De Jesus
 */
export default function CuttingListTable({
  parts,
  hardwareItems = [],
  totalPiecesCount,
  unit,
  onSetUnit,
  selectedId,
  editingId,
  editDraft,
  isRipSorted,
  formatDim,
  onRowClick,
  onSelectHardware,
  onStartEditing,
  onChangeEditDraft,
  onSaveEdit,
  onCancelEdit,
  onDeleteRow,
  onAddPart,
  onExportCsv,
  onExportPdf,
  children,
}) {
  const activeUnit = normalizeUnitCode(unit)

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col flex-1 transition-colors">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100">
            Cutting List
          </h2>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>
              ({parts.length} rows · {totalPiecesCount} pcs ·
            </span>
            <select
              aria-label="Cutting List measurement unit"
              value={activeUnit}
              onChange={(e) => onSetUnit?.(e.target.value)}
              className="px-1.5 py-0.5 text-xs font-bold text-zinc-900 dark:text-[#FACC15] bg-zinc-100 dark:bg-zinc-800 hover:bg-[#FACC15]/40 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 focus:border-[#EAB308] rounded-md focus:outline-none cursor-pointer transition-colors"
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
            <span>)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onExportPdf}
            title="Print ISO Shop Cut Sheet (PDF)"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent dark:border-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF Sheet</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            title="Export Excel / CSV Cutlist"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent dark:border-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={onAddPart}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-950 bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add Part</span>
          </button>
        </div>
      </div>

      {/* Embedded Multi-Project Tray (`<ProjectTray />`) */}
      {children}

      {/* Master Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <th className="py-2.5 pl-2.5 pr-1.5 w-11">#</th>
              <th className="py-2.5 px-2">PART &amp; SOURCE JOBS</th>
              <th className="py-2.5 px-1.5 w-14 text-center">QTY</th>
              <th className="py-2.5 px-1.5 w-14">L</th>
              <th className="py-2.5 px-1.5 w-14">W ↓</th>
              <th className="py-2.5 px-1.5 w-12">H</th>
              <th className="py-2.5 px-2">CORNER</th>
              <th className="py-2.5 px-2">MATERIAL</th>
              <th className="py-2.5 pl-1 pr-2.5 text-right w-18">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-[13px]">
            {parts.map((row, rowIdx) => {
              const isSelected = row.id === selectedId
              const isEditing = row.id === editingId
              const qtyVal = Number(row.qty) || 1
              const displayPartName =
                row.panelRole && isAmbiguousCadName(row.part)
                  ? row.panelRole
                  : disambiguateCutlistPartName(row.part, rowIdx)
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
                      ? 'bg-yellow-50/90 dark:bg-yellow-500/15 hover:bg-yellow-100/80 dark:hover:bg-yellow-500/20 border-l-4 border-l-[#FACC15]'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border-l-4 border-l-transparent'
                  }`}
                >
                  {/* # Badge */}
                  <td className="py-2 pl-2.5 pr-1.5 font-medium">
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
                  <td className="py-2 px-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDraft.part}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onChangeEditDraft({ ...editDraft, part: e.target.value })
                        }
                        className="w-28 px-2 py-0.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                      />
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{displayPartName}</span>
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
                                ? 'bg-zinc-900 dark:bg-zinc-950 text-[#FACC15] border border-zinc-700'
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
                  <td className="py-2 px-1.5 text-center tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        min="1"
                        value={editDraft.qty}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onChangeEditDraft({ ...editDraft, qty: e.target.value })
                        }
                        className="w-12 px-1 py-0.5 text-xs text-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                      />
                    ) : (
                      <span
                        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-extrabold ${
                          isMultiJob
                            ? 'bg-zinc-900 dark:bg-zinc-950 text-[#FACC15]'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        ×{qtyVal}
                      </span>
                    )}
                  </td>

                  {/* L */}
                  <td className="py-2 px-1.5 text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editDraft.l}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onChangeEditDraft({ ...editDraft, l: e.target.value })
                        }
                        className="w-14 px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                      />
                    ) : (
                      formatDim(row.l)
                    )}
                  </td>

                  {/* W */}
                  <td className="py-2 px-1.5 text-zinc-900 dark:text-zinc-100 font-bold tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editDraft.w}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onChangeEditDraft({ ...editDraft, w: e.target.value })
                        }
                        className="w-14 px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
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
                  <td className="py-2 px-1.5 text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editDraft.h}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onChangeEditDraft({ ...editDraft, h: e.target.value })
                        }
                        className="w-12 px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                      />
                    ) : (
                      formatDim(row.h)
                    )}
                  </td>

                  {/* CORNER */}
                  <td className="py-2 px-2 text-zinc-600 dark:text-zinc-400">
                    {isEditing ? (
                      <select
                        value={editDraft.corner}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onChangeEditDraft({ ...editDraft, corner: e.target.value })
                        }
                        className="px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                      >
                        <option value="None">None</option>
                        <option value="Edge 1x">Edge 1x</option>
                        <option value="Edge 2x">Edge 2x</option>
                      </select>
                    ) : (
                      <span
                        className={
                          row.corner === 'None'
                            ? 'text-zinc-500 dark:text-zinc-500'
                            : 'text-zinc-800 dark:text-zinc-200 font-medium'
                        }
                      >
                        {row.corner}
                      </span>
                    )}
                  </td>

                  {/* MATERIAL */}
                  <td className="py-2 px-2 text-zinc-800 dark:text-zinc-200 font-medium">
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
                        className="px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-[#EAB308] rounded focus:outline-none"
                      >
                        <option value="18mm Marine Plywood">
                          18mm Marine Plywood
                        </option>
                        <option value="MDF">MDF</option>
                        <option value="Plywood">Plywood</option>
                        <option value="Oak Veneer">Oak Veneer</option>
                      </select>
                    ) : (
                      row.material
                    )}
                  </td>

                  {/* ACTIONS */}
                  <td className="py-2 pl-1 pr-2.5 text-right">
                    {isEditing ? (
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Save changes"
                          onClick={onSaveEdit}
                          className="p-1 rounded-md bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          title="Cancel"
                          onClick={onCancelEdit}
                          className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-end gap-1.5 text-zinc-700 dark:text-zinc-300">
                        <button
                          type="button"
                          title="Edit row"
                          onClick={(e) => onStartEditing(e, row)}
                          className="p-1 rounded-md text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete row"
                          onClick={(e) => onDeleteRow(e, row)}
                          className="p-1 rounded-md text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-950 hover:bg-[#FACC15] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom "Hardware & Fittings" Specification Note (Non-Sheet Stock Callout) */}
      {Array.isArray(hardwareItems) && hardwareItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-800 flex flex-col gap-2">
          {hardwareItems.map((hw) => {
            const isHwSelected = selectedId === hw.id
            const qtyCount = Number(hw.qty) || 1
            return (
              <div
                key={hw.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectHardware?.(hw)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectHardware?.(hw)
                  }
                }}
                className={`rounded-xl border-l-4 border-l-[#FACC15] border transition-all cursor-pointer px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 ${
                  isHwSelected
                    ? 'bg-zinc-900 dark:bg-zinc-950 border-[#FACC15] ring-1 ring-[#FACC15] shadow-md'
                    : 'bg-zinc-900/95 dark:bg-zinc-950/90 border-zinc-800 hover:border-[#FACC15]/70'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#FACC15] text-zinc-950 uppercase tracking-wider">
                      Hardware &amp; Fittings
                    </span>
                    <span className="text-xs font-bold text-zinc-100">
                      {hw.title || 'Hardware / Leg Assemblies (Non-Sheet Stock)'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                    <span className="font-bold text-[#FACC15]">
                      {hw.part || 'Cabinet Foot / Leg'} (×{qtyCount})
                    </span>
                    <span className="text-zinc-500">·</span>
                    <span className="font-mono font-semibold text-zinc-200">
                      {formatDim(hw.l)} {activeUnit} × {formatDim(hw.w)} {activeUnit} ×{' '}
                      {formatDim(hw.h)} {activeUnit}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-0.5">
                  <span className="text-[11px] font-medium text-zinc-400">
                    {hw.remarks ||
                      'Solid hardware component — excluded from 18mm sheet cutlist'}
                  </span>
                  <span className="text-[10px] font-bold text-[#FACC15]">
                    {isHwSelected
                      ? 'Highlighting all 4 feet in 3D view'
                      : 'Click to highlight feet in 3D view'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
