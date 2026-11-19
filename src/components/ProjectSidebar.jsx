import React, { useState } from 'react'
import {
  CheckSquare,
  Square,
  GitMerge,
  ArrowDownWideNarrow,
  Plus,
  Check,
  X,
  FolderKanban,
} from 'lucide-react'
import { PROJECT_SCHEDULES } from '../utils/aggregator'

/**
 * Workshop Project Controls Sidebar (`src/components/ProjectSidebar.jsx`)
 * Positioned in the Left Column directly beneath `<UploadCard />`.
 *
 * Features:
 *  - High-contrast matte charcoal header (#111827) with safety-yellow `PROJECTS` badge
 *  - Vertical stack of selectable project cards with 3px `#FACC15` active bar,
 *    source badge (`3D CAD`, `OCR`, or `Preset`), and monospace part/piece counts
 *  - Multi-project selection toggles, `Consolidate Jobs`, and `Sort for Rip Cuts (W ↓)`
 *  - Bottom-anchored `+ Add Project` button with inline project creation
 */
export default function ProjectSidebar({
  projects = PROJECT_SCHEDULES,
  selectedJobs = [],
  activeProjectId,
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

  const getProjectBadge = (job) => {
    if (job.sourceType === 'ocr' || job.id?.toLowerCase().includes('ocr')) {
      return {
        label: 'OCR',
        className:
          'bg-zinc-900 dark:bg-zinc-950 text-[#FACC15] border-zinc-700 dark:border-zinc-700',
      }
    }
    if (job.modelFile || job.modelUrl || job.sourceType === 'cad') {
      return {
        label: '3D CAD',
        className:
          'bg-[#FACC15]/20 text-zinc-900 dark:text-[#FACC15] border-[#EAB308]/60',
      }
    }
    return {
      label: 'Preset',
      className:
        'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden flex-1 flex flex-col justify-between transition-colors">
      {/* Top Section: Header + Project List + Action Controls */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Matte Charcoal Industrial Header Bar */}
        <div className="bg-[#111827] dark:bg-[#0B0D11] px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.3]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#FACC15]">
              PROJECTS
            </span>
          </div>
          <span className="font-mono text-[10.5px] font-bold text-zinc-300 bg-zinc-800/90 border border-zinc-700 px-1.5 py-0.5 rounded">
            {selectedJobs.length}/{projectList.length} ACTIVE
          </span>
        </div>

        {/* Selectable Vertical Project Cards */}
        <div className="p-3 space-y-1.5 overflow-y-auto flex-1 max-h-[320px] lg:max-h-none">
          {projectList.map((job) => {
            const isSelected = selectedJobs.includes(job.id)
            const isFocused3d = activeProjectId === job.id
            const jobParts = Array.isArray(job.parts) ? job.parts : []
            const partRowsCount = jobParts.length
            const totalPieces = jobParts.reduce(
              (sum, p) => sum + (Number(p.qty) || 1),
              0
            )
            const badge = getProjectBadge(job)

            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onToggleJob?.(job.id)}
                className={`w-full text-left rounded-xl px-2.5 py-2 border transition-all flex items-start gap-2 group ${
                  isSelected
                    ? 'border-l-[3px] border-l-[#FACC15] border-t-[#FACC15]/50 border-r-[#FACC15]/50 border-b-[#FACC15]/50 bg-yellow-50/75 dark:bg-[#FACC15]/10 shadow-2xs'
                    : 'border-l-[3px] border-l-transparent border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50'
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 transition-colors ${
                    isSelected
                      ? 'text-zinc-950 dark:text-[#FACC15]'
                      : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 stroke-[2.4]" />
                  ) : (
                    <Square className="w-4 h-4 stroke-[2]" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`text-[12px] font-bold truncate ${
                        isSelected
                          ? 'text-zinc-950 dark:text-zinc-50'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {job.shortLabel || job.id}
                    </span>
                    {isFocused3d && (
                      <span
                        title="Active in 3D Viewport"
                        className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#FACC15] ring-2 ring-[#FACC15]/30"
                      />
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-1.5">
                    <span
                      className={`inline-flex items-center px-1.5 py-[1px] rounded text-[9.5px] font-extrabold uppercase tracking-wider border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="font-mono text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {partRowsCount}r · {totalPieces} pcs
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Multi-Project Consolidation & Table-Saw Rip Sorter Controls */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-zinc-800/90 space-y-1.5">
          <button
            type="button"
            onClick={onConsolidateJobs}
            className={`w-full py-2 px-2.5 rounded-xl text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 border transition-all ${
              isConsolidated
                ? 'bg-[#FACC15] text-zinc-950 border-[#EAB308] shadow-xs'
                : 'bg-[#111827] dark:bg-zinc-950 hover:bg-[#FACC15] text-[#FACC15] hover:text-zinc-950 border-zinc-800 dark:border-zinc-700 hover:border-[#EAB308]'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5 stroke-[2.3]" />
            <span>Consolidate Jobs</span>
          </button>

          <button
            type="button"
            onClick={onSortForRipCuts}
            className={`w-full py-2 px-2.5 rounded-xl text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 border transition-all ${
              isRipSorted
                ? 'bg-[#FACC15] text-zinc-950 border-[#EAB308] shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800/90 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] text-zinc-900 dark:text-zinc-100 hover:text-zinc-950 dark:hover:text-zinc-950 border-zinc-300 dark:border-zinc-700 hover:border-[#EAB308]'
            }`}
          >
            <ArrowDownWideNarrow className="w-3.5 h-3.5 stroke-[2.3]" />
            <span>Sort for Rip Cuts (W ↓)</span>
          </button>

          {/* Compact Consolidation / Rip Status Indicators */}
          {(isConsolidated || isRipSorted) && (
            <div className="pt-1 space-y-1">
              {isConsolidated && (
                <div className="text-[10px] font-mono font-bold text-amber-800 dark:text-[#FACC15] bg-yellow-50 dark:bg-[#FACC15]/10 border border-yellow-200 dark:border-[#FACC15]/30 rounded-lg px-2 py-1">
                  Merged {aggregationStats?.duplicateRowsEliminated ?? 0} duplicate rows
                </div>
              )}
              {isRipSorted && (
                <div className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-2 py-1">
                  Rip Seq Active · {aggregationStats?.fenceSetupsCount ?? 1} fence setups
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Anchored "+ Add Project" Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-[#0B0D11]/70">
        {isAddingProject ? (
          <form
            onSubmit={handleConfirmAddProject}
            className="flex items-center gap-1 bg-white dark:bg-zinc-950 border-2 border-[#FACC15] rounded-xl px-2 py-1.5"
          >
            <input
              type="text"
              autoFocus
              value={newProjectLabel}
              onChange={(e) => setNewProjectLabel(e.target.value)}
              placeholder={`Job ${projectList.length + 1} (Custom)`}
              className="w-full min-w-0 bg-transparent text-xs font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              title="Confirm new project"
              className="p-1 rounded-md bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] shrink-0 transition-colors"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              title="Cancel"
              onClick={() => {
                setIsAddingProject(false)
                setNewProjectLabel('')
              }}
              className="p-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingProject(true)}
            className="w-full py-2 px-3 rounded-xl bg-[#111827] dark:bg-zinc-950 hover:bg-[#FACC15] text-[#FACC15] hover:text-zinc-950 border border-[#FACC15] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.6]" />
            <span>Add Project</span>
          </button>
        )}
      </div>
    </div>
  )
}
