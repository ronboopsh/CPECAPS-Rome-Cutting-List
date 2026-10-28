import React from 'react'
import {
  ClipboardList,
  Layers,
  FileSpreadsheet,
  Plus,
} from 'lucide-react'

/**
 * Stock & Remnant Scrap Inventory Panel (`src/components/InventoryPanel.jsx`)
 * Enforces >= 70% area utilization tracking and stock sheet entry.
 */
export default function InventoryPanel({
  inventory,
  unit,
  formatDim,
  newSheet,
  onSetNewSheet,
  onAddMaterial,
}) {
  const nextInventoryIndex = inventory.length + 1

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col justify-between flex-1">
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[16px] font-bold text-zinc-900">Inventory</h2>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
            Stock &amp; Scrap (&ge;70%)
          </span>
        </div>

        {/* Compact Column Header: # | L | W | H | MAT */}
        <div className="grid grid-cols-12 items-center text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b-2 border-zinc-200 pb-2 px-1">
          <div className="col-span-2">#</div>
          <div className="col-span-3">L</div>
          <div className="col-span-3">W</div>
          <div className="col-span-2">H</div>
          <div className="col-span-2 text-right">MAT</div>
        </div>

        {/* Stock Sheets List */}
        <div className="divide-y divide-gray-100">
          {inventory.map((sheet) => (
            <div
              key={sheet.id}
              className="py-3 px-1 hover:bg-yellow-50/40 rounded-xl transition-colors"
            >
              {/* Sheet Dimensions Row */}
              <div className="grid grid-cols-12 items-center text-[12.5px] font-medium text-zinc-800">
                <div className="col-span-2 flex items-center gap-1.5 text-zinc-700">
                  {sheet.iconType === 'clipboard' && (
                    <ClipboardList className="w-3.5 h-3.5 text-zinc-800 shrink-0" />
                  )}
                  {sheet.iconType === 'layers' && (
                    <Layers className="w-3.5 h-3.5 text-zinc-800 shrink-0" />
                  )}
                  {sheet.iconType === 'sheet' && (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-800 shrink-0" />
                  )}
                  <span className="font-bold text-zinc-900">#{sheet.num}</span>
                </div>
                <div className="col-span-3 tabular-nums text-zinc-900 font-semibold">
                  {formatDim(sheet.l)}{' '}
                  <span className="text-zinc-400 font-normal">×</span>
                </div>
                <div className="col-span-3 tabular-nums text-zinc-900 font-semibold">
                  {formatDim(sheet.w)}{' '}
                  <span className="text-zinc-400 font-normal">×</span>
                </div>
                <div className="col-span-2 tabular-nums text-zinc-800">
                  {formatDim(sheet.h)}
                  <span className="text-[11px] text-zinc-500 ml-0.5">
                    {unit === 'metric' ? 'mm' : '"'}
                  </span>
                </div>
                <div className="col-span-2 text-right font-bold text-zinc-900 truncate">
                  {sheet.material}
                </div>
              </div>

              {/* Usage Progress Bar Underneath: Yellow/Amber/Gold over Dark Charcoal Track */}
              <div className="mt-2 flex items-center gap-2.5 pl-5">
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${sheet.barColor} transition-all duration-300`}
                    style={{ width: `${sheet.usedPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-zinc-700 shrink-0 tabular-nums">
                  {sheet.usedPercent}% used
                </span>
              </div>
            </div>
          ))}

          {/* Next Row: Input fields to enter a new sheet length, width, and material */}
          <div className="py-3 px-1">
            <div className="grid grid-cols-12 items-center gap-1.5 text-[12.5px]">
              <div className="col-span-2 font-bold text-zinc-600 pl-1">
                #{nextInventoryIndex}
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  aria-label="New sheet length"
                  value={newSheet.l}
                  onChange={(e) =>
                    onSetNewSheet({ ...newSheet, l: e.target.value })
                  }
                  onKeyDown={(e) => e.key === 'Enter' && onAddMaterial()}
                  placeholder="2440"
                  className="w-full px-2 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors tabular-nums"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  aria-label="New sheet width"
                  value={newSheet.w}
                  onChange={(e) =>
                    onSetNewSheet({ ...newSheet, w: e.target.value })
                  }
                  onKeyDown={(e) => e.key === 'Enter' && onAddMaterial()}
                  placeholder="1220"
                  className="w-full px-2 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors tabular-nums"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  aria-label="New sheet thickness"
                  value={newSheet.h}
                  onChange={(e) =>
                    onSetNewSheet({ ...newSheet, h: e.target.value })
                  }
                  onKeyDown={(e) => e.key === 'Enter' && onAddMaterial()}
                  placeholder="18"
                  className="w-full px-1.5 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors tabular-nums"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  aria-label="New sheet material"
                  value={newSheet.material}
                  onChange={(e) =>
                    onSetNewSheet({ ...newSheet, material: e.target.value })
                  }
                  onKeyDown={(e) => e.key === 'Enter' && onAddMaterial()}
                  placeholder="MDF"
                  className="w-full px-1.5 py-1 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#EAB308] focus:bg-white transition-colors text-right"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Action Button: "+ Add Material" */}
      <div className="pt-3 mt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onAddMaterial}
          className="w-full py-2.5 px-4 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] text-zinc-950 font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Add Material</span>
        </button>
      </div>
    </div>
  )
}
