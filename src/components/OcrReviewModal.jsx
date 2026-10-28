import React, { useState } from 'react';
import { AlertTriangle, Check, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function OcrReviewModal({ isOpen, onClose, ocrData, onCommit }) {
  if (!isOpen || !ocrData) return null;

  const [parts, setParts] = useState(ocrData.parts || []);
  const [zoomLevel, setZoomLevel] = useState(1);
  const imageUrl = ocrData.imageUrl || '';

  const handleCellChange = (index, field, value) => {
    setParts(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: ['quantity', 'length', 'width', 'thickness'].includes(field)
          ? parseFloat(value) || 0
          : value,
        // Mark field as confirmed once edited
        [`${field}_confidence`]: 1.0,
      };
      return updated;
    });
  };

  const handleRemoveRow = (index) => {
    setParts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndCommit = () => {
    onCommit(parts);
    onClose();
  };

  const isLowConfidence = (conf) => typeof conf === 'number' && conf < 0.8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-7xl h-[90vh] bg-[#111827] border-2 border-[#FACC15] rounded-lg shadow-2xl overflow-hidden text-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#18181B] border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-[#FACC15] text-[#111827] font-bold rounded">OCR</span>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white uppercase">
                Paper Cutlist Verification & Review
              </h2>
              <p className="text-xs text-gray-400">
                Verify scanned handwritten/printed entries. Values highlighted in yellow have &lt; 80% OCR confidence.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body: Side-by-Side Split */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Panel: Scanned Document Viewer */}
          <div className="w-1/2 border-r border-gray-800 flex flex-col bg-[#0B0F17]">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-400">
              <span>Source Document Preview</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                  className="p-1 hover:text-[#FACC15] transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3.0))}
                  className="p-1 hover:text-[#FACC15] transition"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1 hover:text-[#FACC15] transition"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Scanned Cutlist"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  className="transition-transform duration-150 max-w-full shadow-md rounded border border-gray-700"
                />
              ) : (
                <div className="text-center text-gray-500 text-sm">
                  No image preview available for this scan.
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Editable Interactive Grid */}
          <div className="w-1/2 flex flex-col bg-[#111827]">
            <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex justify-between items-center text-xs">
              <span className="font-medium text-gray-300">Extracted Part Specifications</span>
              <span className="text-[#FACC15] font-mono">{parts.length} Rows Detected</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#18181B] text-gray-300 uppercase tracking-wider border-b border-gray-700">
                    <th className="py-2 px-2">Part Name</th>
                    <th className="py-2 px-1 text-center">Qty</th>
                    <th className="py-2 px-1 text-center">L (mm)</th>
                    <th className="py-2 px-1 text-center">W (mm)</th>
                    <th className="py-2 px-1 text-center">Thk</th>
                    <th className="py-2 px-2">Material</th>
                    <th className="py-2 px-1 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {parts.map((part, idx) => {
                    const lowConf = isLowConfidence(part.confidence);
                    return (
                      <tr key={part.id || idx} className="hover:bg-gray-800/50">
                        {/* Part Name */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={part.part_name}
                            onChange={(e) => handleCellChange(idx, 'part_name', e.target.value)}
                            className={`w-full px-2 py-1 bg-gray-950 rounded text-gray-100 border text-xs ${
                              lowConf ? 'bg-amber-100 text-gray-900 border-amber-400 font-semibold' : 'border-gray-700'
                            }`}
                          />
                        </td>
                        {/* Quantity */}
                        <td className="p-1">
                          <input
                            type="number"
                            value={part.quantity}
                            onChange={(e) => handleCellChange(idx, 'quantity', e.target.value)}
                            className="w-12 px-1 py-1 bg-gray-950 border border-gray-700 rounded text-center text-gray-100 text-xs"
                          />
                        </td>
                        {/* Length */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.5"
                            value={part.length}
                            onChange={(e) => handleCellChange(idx, 'length', e.target.value)}
                            className="w-16 px-1 py-1 bg-gray-950 border border-gray-700 rounded text-center text-gray-100 text-xs"
                          />
                        </td>
                        {/* Width */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.5"
                            value={part.width}
                            onChange={(e) => handleCellChange(idx, 'width', e.target.value)}
                            className="w-16 px-1 py-1 bg-gray-950 border border-gray-700 rounded text-center text-gray-100 text-xs"
                          />
                        </td>
                        {/* Thickness */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="1"
                            value={part.thickness}
                            onChange={(e) => handleCellChange(idx, 'thickness', e.target.value)}
                            className="w-12 px-1 py-1 bg-gray-950 border border-gray-700 rounded text-center text-gray-100 text-xs"
                          />
                        </td>
                        {/* Material */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={part.material}
                            onChange={(e) => handleCellChange(idx, 'material', e.target.value)}
                            className="w-full px-2 py-1 bg-gray-950 border border-gray-700 rounded text-gray-100 text-xs"
                          />
                        </td>
                        {/* Remove Row Action */}
                        <td className="p-1 text-center">
                          <button
                            onClick={() => handleRemoveRow(idx)}
                            className="text-gray-500 hover:text-red-400 p-1 transition"
                            title="Delete row"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {parts.some(p => isLowConfidence(p.confidence)) && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/40 rounded flex items-center space-x-2 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Some detected values have low confidence. Review highlighted fields carefully before committing.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#18181B] border-t border-gray-800">
          <span className="text-xs text-gray-400 font-mono">
            Commit Status: Ready for verification commit
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 border border-gray-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndCommit}
              className="px-5 py-2 rounded text-sm font-bold bg-[#FACC15] hover:bg-yellow-400 text-[#111827] flex items-center space-x-2 transition shadow"
            >
              <Check className="w-4 h-4" />
              <span>Verify &amp; Commit to Working Cutlist</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
