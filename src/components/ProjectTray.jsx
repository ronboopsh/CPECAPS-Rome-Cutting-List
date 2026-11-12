import React, { useState } from 'react'
import {
  CheckSquare,
  Square,
  GitMerge,
  Plus,
  Check,
  X,
} from 'lucide-react'
import { PROJECT_SCHEDULES } from '../utils/aggregator'

/**
 * Multi-Project Selector & Saw-Setup Rip Sorter Controls (`src/components/ProjectTray.jsx`)
 * Owner: Rene De Jesus
 *
 * Features:
 *  - Displays "PROJECTS:" pill selector in the dark charcoal control box (#111827 / bg-zinc-900).
 *  - Includes a compact "+" button anchored at the bottom-right corner of the black box to
 *    create and select a new custom project pill on the fly.
 */
export default function ProjectTray({
  projects = PROJECT_SCHEDULES,
  selectedJobs = [],
  onToggleJob,
  onCreateProject,
  isConsolidated,
  isRipSorted,
  aggregationStats,
  onConsolidateJobs,
  onSortForRipCuts,
}) {
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [newProjectLabel, setNewProjectLabel] = useState('')

  const projectList = Array.isArray(projects)
    ? projects
    : Object.values(projects || PROJECT_SCHEDULES)

  const handleConfirmAddProject = (e) => {
    e?.preventDefault()
    const trimmed = newProjectLabel.trim()
    const nextIndex = projectList.length + 1
    const finalName = trimmed || `Job ${nextIndex} (Custom Cabinet)`
    if (typeof onCreateProject === 'function') {
      onCreateProject(finalName)
    }
    setNewProjectLabel('')
    setIsAddingProject(false)
  }

  return (
    <div className="relative mb-3 p-3 rounded-xl bg-zinc-900 text-zinc-100 border border-zinc-800 space-y-2.5">
      {/* Row 1: "PROJECTS:" label + Project Checkboxes */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mr-1">
          PROJECTS:
        </span>
        {projectList.map((job) => {
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
              <span>{job.shortLabel || job.id}</span>
            </button>
          )
        })}
      </div>

      {/* Row 2: Action Buttons on Left + Compact "+" Add Project Button Anchored Bottom-Right */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
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
        </div>

        {/* Bottom-Right Anchored "+" Project Creator */}
        <div className="flex items-center gap-1.5 ml-auto">
          {isAddingProject ? (
            <form
              onSubmit={handleConfirmAddProject}
              className="flex items-center gap-1 bg-zinc-950 border border-[#FACC15] rounded-lg px-2 py-1"
            >
              <input
                type="text"
                autoFocus
                value={newProjectLabel}
                onChange={(e) => setNewProjectLabel(e.target.value)}
                placeholder={`Job ${projectList.length + 1} (Custom Cabinet)`}
                className="w-36 sm:w-44 bg-transparent text-xs font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                title="Confirm new project"
                className="p-1 rounded bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] transition-colors"
              >
                <Check className="w-3 h-3 stroke-[2.5]" />
              </button>
              <button
                type="button"
                title="Cancel"
                onClick={() => {
                  setIsAddingProject(false)
                  setNewProjectLabel('')
                }}
                className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              title="Add New Project"
              onClick={() => setIsAddingProject(true)}
              className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-[#FACC15] text-[#FACC15] hover:text-zinc-950 border border-[#FACC15] flex items-center justify-center transition-all shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
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
