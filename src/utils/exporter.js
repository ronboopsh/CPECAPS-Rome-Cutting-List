/**
 * ============================================================================
 * DOCUMENT EXPORTERS (`src/utils/exporter.js`)
 * Owner: Pamela Calma
 * ISO-Compliant Shop Cut Sheets in Printable PDF (with checkboxes) and
 * Excel (.xlsx / .csv) Spreadsheet Export.
 * ============================================================================
 */

export function formatDimensionByUnit(mmValue, unit = 'metric') {
  if (unit === 'metric') return Number(mmValue) || 0
  const inches = (Number(mmValue) || 0) / 25.4
  return inches >= 10 ? Number(inches.toFixed(1)) : Number(inches.toFixed(2))
}

/**
 * Exports the active cutting list to an Excel-compatible CSV/XLSX table download.
 */
export function exportCuttingListToCsv(parts = [], unit = 'metric') {
  const unitLabel = unit === 'metric' ? 'mm' : 'in'
  const headers = [
    '#',
    'Part Name',
    'Qty',
    `Length (${unitLabel})`,
    `Width (${unitLabel})`,
    `Thickness (${unitLabel})`,
    'Corner / Edge',
    'Material',
    'Source Jobs',
  ]

  const csvRows = [
    headers.join(','),
    ...parts.map((p) =>
      [
        p.num,
        `"${String(p.part || '').replace(/"/g, '""')}"`,
        Number(p.qty) || 1,
        formatDimensionByUnit(p.l, unit),
        formatDimensionByUnit(p.w, unit),
        formatDimensionByUnit(p.h, unit),
        `"${String(p.corner || 'None')}"`,
        `"${String(p.material || 'MDF')}"`,
        `"${(Array.isArray(p.source_jobs) ? p.source_jobs : ['Job #1']).join(' + ')}"`,
      ].join(',')
    ),
  ]

  // Prepend UTF-8 BOM so Microsoft Excel opens millimeter symbols and columns cleanly
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rome-cabinets-cutlist-${unitLabel}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Generates an ISO-style printable shop-floor cut sheet (with physical check-off
 * boxes for the table saw operator) and triggers the browser's print-to-PDF dialog.
 */
export function exportCuttingListToPrintablePdf(parts = [], unit = 'metric', selectedJobs = []) {
  const unitLabel = unit === 'metric' ? 'mm' : 'in'
  const totalPieces = parts.reduce((acc, p) => acc + (Number(p.qty) || 1), 0)
  const printWin = window.open('', '_blank', 'width=960,height=720')
  if (!printWin) return false

  const rowsHtml = parts
    .map((p) => {
      const jobs = (Array.isArray(p.source_jobs) ? p.source_jobs : ['Job #1']).join(', ')
      return `
        <tr>
          <td style="text-align:center;">☐</td>
          <td><strong>${p.num}</strong></td>
          <td>${p.part}</td>
          <td style="text-align:center;"><strong>×${p.qty || 1}</strong></td>
          <td style="text-align:right;">${formatDimensionByUnit(p.l, unit)}</td>
          <td style="text-align:right;"><strong>${formatDimensionByUnit(p.w, unit)}</strong></td>
          <td style="text-align:right;">${formatDimensionByUnit(p.h, unit)}</td>
          <td>${p.corner || 'None'}</td>
          <td>${p.material || 'MDF'}</td>
          <td>${jobs}</td>
        </tr>
      `
    })
    .join('')

  printWin.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Rome Cabinets — ISO Shop Cut Sheet</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 24px; }
          .banner { border-bottom: 3px solid #111827; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .badge { background: #FACC15; color: #111827; padding: 3px 8px; font-weight: 800; font-size: 12px; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #111827; color: #FACC15; text-align: left; padding: 8px; text-transform: uppercase; }
          td { border-bottom: 1px solid #D1D5DB; padding: 7px 8px; }
        </style>
      </head>
      <body>
        <div class="banner">
          <div>
            <h1 style="margin:0;font-size:20px;text-transform:uppercase;">Rome Cabinets — Shop-Floor Cut Sheet</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#4B5563;">
              Active Schedules: ${selectedJobs.join(', ') || 'All Jobs'} · Total Rows: ${parts.length} (${totalPieces} Pcs) · Units: ${unitLabel}
            </p>
          </div>
          <span class="badge">TABLE SAW RIP SEQUENCE (W ↓)</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:36px;text-align:center;">CUT</th>
              <th style="width:44px;">#</th>
              <th>Part Name</th>
              <th style="width:52px;text-align:center;">Qty</th>
              <th style="width:70px;text-align:right;">L (${unitLabel})</th>
              <th style="width:70px;text-align:right;">W ↓ (${unitLabel})</th>
              <th style="width:60px;text-align:right;">H (${unitLabel})</th>
              <th>Corner</th>
              <th>Material</th>
              <th>Source Jobs</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `)
  printWin.document.close()
  printWin.focus()
  printWin.print()
  return true
}
