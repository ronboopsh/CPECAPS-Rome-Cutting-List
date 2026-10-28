import React from 'react'
import {
  CheckSquare,
  Square,
  GitMerge,
  ArrowDownWideNarrow,
} from 'lucide-react'
import { PROJECT_SCHEDULES } from '../utils/aggregator'

/**
 * Multi-Project Selector & Saw-Setup Rip Sorter Controls (`src/components/ProjectTray.jsx`)
 * Owner: Rene De Jesus
 */
export default function ProjectTray({
  selectedJobs,
  onToggleJob,
  isConsolidated,
  isRipSorted,
  aggregationStats,
  onConsolidateJobs,
  onSortForRipCuts,
}) {
  return (
    <div className="mb-3 p-3 rounded-xl bg-zinc-900 text-zinc-100 border border-zinc-800 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Multi-project selector toggle pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mr-1">
            Schedules:
          </span>
          {Object.values(PROJECT_SCHEDULES).map((job) => {
            const active = selectedJobs.includes(job.id)
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onToggleJob(job.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  active
                    ? 'bg-[#FACC15] text-zinc-950 border-[#EAB308] shadow-2xs'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {active ? (
                  <CheckSquare className="w-3.5 h-3.5 stroke-[2.4]" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                <span>{job.shortLabel}</span>
              </button>
            )
          })}
        </div>

        {/* Action Buttons: "Consolidate Jobs" and "Sort for Rip Cuts (W ↓)" */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onConsolidateJobs}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              isConsolidated
                ? 'bg-[#FACC15] text-zinc-950 ring-2 ring-yellow-300'
                : 'bg-zinc-800 hover:bg-[#FACC15] text-[#FACC15] hover:text-zinc-950 border border-[#FACC15]/50'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5 stroke-[2.3]" />
            <span>Consolidate Jobs</span>
          </button>

          <button
            type="button"
            onClick={onSortForRipCuts}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              isRipSorted
                ? 'bg-[#FACC15] text-zinc-950 ring-2 ring-yellow-300'
                : 'bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950'
            }`}
          >
            <ArrowDownWideNarrow className="w-3.5 h-3.5 stroke-[2.3]" />
            <span>Sort for Rip Cuts (W ↓)</span>
          </button>
        </div>
      </div>

      {/* Live Consolidation & Saw-Setup Status Strip */}
      {(isConsolidated || isRipSorted) && (
        <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
          <div className="flex flex-wrap items-center gap-2">
            {isConsolidated && (
              <span className="inline-flex items-center gap-1 bg-zinc-800 text-[#FACC15] px-2 py-0.5 rounded font-bold">
                Merged {aggregationStats?.duplicateRowsEliminated ?? 0} Identical Part
                Schedules
              </span>
            )}
            {isRipSorted && (
              <span className="inline-flex items-center gap-1 bg-zinc-800 text-emerald-300 px-2 py-0.5 rounded font-bold">
                Rip Sequence Active: Grouped by Material &amp; H → Width (W ↓) → Length (L
                ↓) ({aggregationStats?.fenceSetupsCount ?? 5} Fence Setups)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
