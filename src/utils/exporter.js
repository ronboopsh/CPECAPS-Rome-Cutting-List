/**
 * src/utils/exporter.js
 * Exporters for ISO-compliant Shop Cut Sheets (PDF) and Workbooks (Excel/CSV).
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Exports the cutlist to an ISO-compliant printable PDF cut sheet.
 * Grouped and sorted for table saw rip cuts: Material -> Thickness -> Width (Desc).
 */
export function exportToPdf(parts, projectNames = ['All Selected Projects']) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary Theme Colors (Industrial Black & Yellow)
  const PRIMARY_BLACK = [17, 24, 39]; // #111827
  const ACCENT_YELLOW = [250, 204, 21]; // #FACC15
  const SECONDARY_GRAY = [107, 114, 128];

  // Header Banner
  doc.setFillColor(...PRIMARY_BLACK);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  doc.setFillColor(...ACCENT_YELLOW);
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Header Typography
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ROME CABINETS — SHOP-FLOOR CUT SHEET', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(
    `Rip-Sorted Saw Schedule | Generated: ${new Date().toLocaleString()} | Projects: ${projectNames.join(', ')}`,
    14,
    22
  );

  // Table Data Mapping
  const tableRows = parts.map((part, index) => [
    '[  ]', // Checkbox for saw operator
    index + 1,
    part.part_name,
    part.quantity,
    part.material,
    `${part.thickness} mm`,
    `${part.width} mm`,
    `${part.length} mm`,
    part.corner_cut || 'None',
    part.source_jobs ? part.source_jobs.join(', ') : (part.project_id || '-'),
  ]);

  doc.autoTable({
    startY: 35,
    head: [[
      'Cut',
      '#',
      'Part Description',
      'Qty',
      'Material',
      'Thk',
      'Width (Rip)',
      'Length',
      'Corner Cut',
      'Job Source'
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 30, 30],
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: PRIMARY_BLACK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' }, // Checkbox
      1: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 38 },
      3: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 28 },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }, // Rip width highlighted
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 18 },
      9: { cellWidth: 22 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(...SECONDARY_GRAY);
      doc.text(str, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);
      doc.text(
        'Note: Fence rip cuts are ordered by Width Descending (W ↓) to minimize fence movement.',
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  doc.save(`Rome_Cabinets_CutSheet_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Exports the cutlist to an Excel (.xlsx) workbook with formatted headers.
 */
export function exportToExcel(parts, filename = 'Rome_Cabinets_CutList') {
  const formattedData = parts.map((part, index) => ({
    'Cut Done': '[  ]',
    'Item #': index + 1,
    'Part Name': part.part_name,
    'Quantity': part.quantity,
    'Material': part.material,
    'Thickness (mm)': part.thickness,
    'Width / Rip (mm)': part.width,
    'Length (mm)': part.length,
    'Corner Cut': part.corner_cut || 'None',
    'Source': part.source || 'CAD',
    'Source Projects': part.source_jobs ? part.source_jobs.join(', ') : part.project_id,
    'Remarks': part.remarks || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Set explicit column widths for readability on shop floor tablets/laptops
  worksheet['!cols'] = [
    { wch: 10 }, // Cut Done
    { wch: 8 },  // Item #
    { wch: 25 }, // Part Name
    { wch: 10 }, // Quantity
    { wch: 22 }, // Material
    { wch: 14 }, // Thickness
    { wch: 16 }, // Width
    { wch: 16 }, // Length
    { wch: 14 }, // Corner Cut
    { wch: 10 }, // Source
    { wch: 20 }, // Source Projects
    { wch: 25 }, // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rip-Sorted Cutlist');
  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Simple CSV fallback export.
 */
export function exportToCsv(parts, filename = 'Rome_Cabinets_CutList') {
  const formattedData = parts.map(part => ({
    Part_Name: part.part_name,
    Quantity: part.quantity,
    Material: part.material,
    Thickness_mm: part.thickness,
    Width_mm: part.width,
    Length_mm: part.length,
    Corner_Cut: part.corner_cut || 'None',
    Jobs: part.source_jobs ? part.source_jobs.join(';') : part.project_id,
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
