/**
 * ============================================================================
 * FASTAPI REST CLIENT (`src/utils/api.js`)
 * Connects the React frontend to the FastAPI backend (`backend/main.py`) with
 * seamless local fallback when running in frontend-only mode.
 * ============================================================================
 */

import { aggregateProjectCutlists, sortPartsForRipCuts } from './aggregator'
import { DEFAULT_OCR_EXTRACTED_ROWS } from '../components/OcrReviewModal'

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
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE_URL}/api/upload-ocr`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch {
    return {
      status: 'local_fallback',
      fileName: file?.name || 'workshop_cutlist_scan_01.jpg',
      rows: DEFAULT_OCR_EXTRACTED_ROWS,
    }
  }
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
