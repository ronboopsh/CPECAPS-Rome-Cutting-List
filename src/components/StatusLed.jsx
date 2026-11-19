import React, { useEffect, useState } from 'react'

/**
 * Status LED for the header. Polls GET /api/diagnostics/health every 10 s.
 *   GREEN = all subsystems OK   AMBER = degraded (e.g. OCR fallback engine)
 *   RED   = a subsystem is faulted, or the API cannot be reached.
 * Hover shows the failing checks with their RC-codes (see docs/DIAGNOSTICS.md).
 * Usage:  <StatusLed />   (e.g. inside Header.jsx next to the theme toggle)
 */
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000'
const COLORS = { GREEN: '#4ade80', AMBER: '#facc15', RED: '#f87171' }

export default function StatusLed({ intervalMs = 10000 }) {
  const [state, setState] = useState({ overall: 'AMBER', title: 'Checking…' })

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/diagnostics/health`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const rep = await res.json()
        const bad = rep.checks.filter((c) => c.led !== 'GREEN')
        const title = bad.length
          ? bad.map((c) => `${c.name}: ${c.code} ${c.detail}`).join('\n')
          : 'All systems OK'
        if (alive) setState({ overall: rep.overall, title })
      } catch (e) {
        if (alive) setState({ overall: 'RED', title: `API unreachable (${e.message})` })
      }
    }
    poll()
    const id = setInterval(poll, intervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [intervalMs])

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={state.title}>
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: COLORS[state.overall], boxShadow: `0 0 6px ${COLORS[state.overall]}` }}
      />
      <span>{state.overall}</span>
    </span>
  )
}
