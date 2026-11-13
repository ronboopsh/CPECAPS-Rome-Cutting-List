/**
 * ============================================================================
 * FASTAPI REST CLIENT (`src/utils/api.js`)
 * Connects the React frontend to the FastAPI backend (`backend/main.py`) with
 * seamless local fallback when running in frontend-only mode.
 * ============================================================================
 */

import { aggregateProjectCutlists, sortPartsForRipCuts } from './aggregator'

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000'

export async function uploadCadFileApi(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE_URL}/api/upload-cad`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch {
    return {
      status: 'local_fallback',
      fileName: file?.name || 'sample_cabinet.dae',
    }
  }
}

export async function uploadOcrImageApi(file) {
  // No silent fallback here: if OCR fails, the caller must show a real error.
  const formData = new FormData()
  formData.append('file', file)
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/upload-ocr`, {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new Error(`Cannot reach the OCR server. Is the backend running on ${API_BASE_URL}?`)
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      detail = (await response.json()).detail || detail
    } catch {
      /* response was not JSON */
    }
    throw new Error(detail)
  }
  return await response.json()
}

export async function aggregateProjectsApi(partsList = []) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: partsList }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch {
    const aggregated = aggregateProjectCutlists(partsList)
    const sorted = sortPartsForRipCuts(aggregated.parts)
    return {
      parts: sorted.parts,
      stats: aggregated.stats,
      fenceSetupsCount: sorted.fenceSetupsCount,
    }
  }
}
