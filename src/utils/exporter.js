/**
 * src/utils/exporter.js
 * Zero-dependency native browser exporters for:
 *  - Auto-Fitted Microsoft Excel XML Spreadsheets (.xls) with dynamic column width calculation
 *  - UTF-8 BOM CSV Workbooks (.csv)
 *  - ISO-compliant Shop Cut Sheets (PDF via window.print)
 *  - Multi-unit carpentry dimension conversion (mm, cm, m, in, ft)
 */

export const MEASUREMENT_UNITS = [
  { value: 'mm', label: 'mm (Millimeters)' },
  { value: 'cm', label: 'cm (Centimeters)' },
  { value: 'm', label: 'm (Meters)' },
  { value: 'in', label: 'in (Inches)' },
  { value: 'ft', label: 'ft (Feet)' },
]

/**
 * Normalizes legacy 'metric'/'imperial' or unit code ('mm', 'cm', 'm', 'in', 'ft') into a canonical unit symbol.
 */
export function normalizeUnitCode(unit = 'mm') {
  if (unit === 'metric') return 'mm'
  if (unit === 'imperial') return 'in'
  if (['mm', 'cm', 'm', 'in', 'ft'].includes(unit)) return unit
  return 'mm'
}

/**
 * Formats a millimeter dimension into the selected carpentry measurement unit:
 *  - mm (1:1, whole number or 1 decimal)
 *  - cm (value / 10, up to 2 decimals)
 *  - m  (value / 1000, 3 decimals)
 *  - in (value / 25.4, 2 decimals)
 *  - ft (value / 304.8, 3 decimals)
 */
export function formatDimensionByUnit(mmValue, unit = 'mm') {
  const num = Number(mmValue) || 0
  const code = normalizeUnitCode(unit)

  switch (code) {
    case 'cm': {
      const val = num / 10
      return Number.isInteger(val) ? `${val}` : val.toFixed(2)
    }
    case 'm': {
      const val = num / 1000
      return val.toFixed(3)
    }
    case 'in': {
      const val = num / 25.4
      return val.toFixed(2)
    }
    case 'ft': {
      const val = num / 304.8
      return val.toFixed(3)
    }
    case 'mm':
    default: {
      return Number.isInteger(num) ? `${num}` : num.toFixed(1)
    }
  }
}

/**
 * Safely escapes `&`, `<`, `>`, `"`, and `'` so long notes or part names containing
 * symbols do not break the Excel XML Spreadsheet syntax.
 */
export function escapeXml(value) {
  const str = value === null || value === undefined ? '' : String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Normalizes a single cutlist row into structured cell values for Excel / CSV export.
 */
function normalizeRowForExport(item) {
  const partName = String(item.part || item.part_name || 'Panel')
  const count = Number(item.qty ?? item.quantity) || 1
  const length = Number(item.l ?? item.length) || 0
  const width = Number(item.w ?? item.width) || 0
  const thickness = Number(item.h ?? item.thickness) || 0
  const material = String(item.material || '18mm Marine Plywood')
  const jobs =
    Array.isArray(item.source_jobs) && item.source_jobs.length > 0
      ? item.source_jobs.join(' + ')
      : item.project_id || ''
  const corner = item.corner || item.corner_cut || 'None'
  const remarks =
    item.remarks ||
    [corner !== 'None' ? `Corner: ${corner}` : '', jobs ? `Jobs: ${jobs}` : '']
      .filter(Boolean)
      .join(' | ') ||
    'Standard Cut'

  return {
    partName,
    count,
    length,
    width,
    thickness,
    material,
    remarks,
  }
}

/**
 * Column definitions with explicit floor minimums (in points) and data types:
 *  - Part Name: min 120 pt
 *  - Count / Qty: min 60 pt
 *  - Length (L): min 75 pt
 *  - Width (W): min 75 pt
 *  - Thickness (H): min 75 pt
 *  - Material: min 130 pt
 *  - Remarks / Jobs: min 180 pt
 */
const EXCEL_COLUMNS = [
  { key: 'partName', header: 'Part', minWidth: 120, type: 'String' },
  { key: 'count', header: 'Count', minWidth: 60, type: 'Number' },
  { key: 'length', header: 'Length', minWidth: 75, type: 'Number' },
  { key: 'width', header: 'Width', minWidth: 75, type: 'Number' },
  { key: 'thickness', header: 'Thickness', minWidth: 75, type: 'Number' },
  { key: 'material', header: 'Material', minWidth: 130, type: 'String' },
  { key: 'remarks', header: 'Remarks', minWidth: 180, type: 'String' },
]

/**
 * Calculates auto-fitted column widths in points for each column across both the header
 * label and all active cutlist rows using:
 *   Math.max(minWidth, maxCharacters * 7.5 + 24)
 */
export function calculateAutoFitColumnWidths(normalizedRows = []) {
  return EXCEL_COLUMNS.map((col) => {
    let maxCharacters = col.header.length
    for (const row of normalizedRows) {
      const cellStr = row[col.key] === null || row[col.key] === undefined ? '' : String(row[col.key])
      if (cellStr.length > maxCharacters) {
        maxCharacters = cellStr.length
      }
    }
    const calculated = Math.round(Math.max(col.minWidth, maxCharacters * 7.5 + 24))
    return calculated
  })
}

/**
 * Generates an Excel 2003 XML Spreadsheet (.xls) with dynamically auto-fitted column widths,
 * bold light-grey (#E5E7EB) header styling, and preserved Number/String cell types.
 */
export function exportToExcelXml(cutlist = [], filename = 'Rome_Cabinets_Cutting_List.xls') {
  const normalizedRows = cutlist.map(normalizeRowForExport)
  const colWidths = calculateAutoFitColumnWidths(normalizedRows)

  const columnTags = colWidths
    .map(
      (colWidth, colIdx) =>
        `        <Column ss:Index="${colIdx + 1}" ss:Width="${colWidth}" ss:AutoFitWidth="1"/>`
    )
    .join('\n')

  const headerCells = EXCEL_COLUMNS.map(
    (col) =>
      `          <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`
  ).join('\n')

  const bodyRows = normalizedRows
    .map((row) => {
      const cells = EXCEL_COLUMNS.map((col) => {
        const val = row[col.key]
        const styleId = col.type === 'Number' ? 'NumberCellStyle' : 'TextCellStyle'
        return `          <Cell ss:StyleID="${styleId}"><Data ss:Type="${col.type}">${escapeXml(val)}</Data></Cell>`
      }).join('\n')
      return `        <Row ss:Height="20">\n${cells}\n        </Row>`
    })
    .join('\n')

  const xmlDocument = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/>
    </Style>
    <Style ss:ID="HeaderStyle">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#9CA3AF"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="TextCellStyle">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="NumberCellStyle">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="Rome Cabinets Cutlist">
    <Table>
${columnTags}
        <Row ss:Height="24">
${headerCells}
        </Row>
${bodyRows}
    </Table>
  </Worksheet>
</Workbook>`

  const blob = new Blob([xmlDocument], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  const baseName = filename.replace(/\.(csv|xlsx|xls)$/i, '')
  link.setAttribute('download', `${baseName}.xls`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}

/**
 * Escapes a single CSV cell value to handle commas, quotes, and newlines safely.
 */
function escapeCsvCell(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Standard CSV fallback export with UTF-8 Byte Order Mark (\uFEFF) so international
 * characters and formatting are preserved.
 * Headers: "Part,Count,Length,Width,Thickness,Material,Remarks"
 */
export function exportToCSV(cutlist = [], filename = 'Rome_Cabinets_Cutting_List.csv') {
  // If called from the main Excel/CSV button without forcing .csv, or if .xls is requested,
  // use the auto-fitted Excel XML export when filename ends with .xls
  if (filename.toLowerCase().endsWith('.xls')) {
    return exportToExcelXml(cutlist, filename)
  }

  const headers = ['Part', 'Count', 'Length', 'Width', 'Thickness', 'Material', 'Remarks']
  const normalizedRows = cutlist.map(normalizeRowForExport)

  const rows = normalizedRows.map((row) =>
    [
      escapeCsvCell(row.partName),
      escapeCsvCell(row.count),
      escapeCsvCell(row.length),
      escapeCsvCell(row.width),
      escapeCsvCell(row.thickness),
      escapeCsvCell(row.material),
      escapeCsvCell(row.remarks),
    ].join(',')
  )

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.setAttribute('download', finalFilename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}

/**
 * Triggers the browser's built-in print dialog using window.print().
 */
export function exportToPDF() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print()
    return true
  }
  return false
}

// Aliases so all existing or alternative call sites across App.jsx, CuttingListTable.jsx, and Header.jsx remain seamless
export const exportToExcel = (parts, filename = 'Rome_Cabinets_Cutting_List.xls') =>
  exportToExcelXml(parts, filename)
export const exportCuttingListToCsv = (parts) =>
  exportToExcelXml(parts, 'Rome_Cabinets_Cutting_List.xls')
export const exportToCsv = exportToCSV
export const exportCuttingListToPrintablePdf = () => exportToPDF()
export const exportToPdf = exportToPDF
