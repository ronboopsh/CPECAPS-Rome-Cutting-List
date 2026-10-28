import React from 'react'
import { Upload, Camera, FileCode2, Sparkles } from 'lucide-react'

/**
 * Dual-Mode Upload Card (`src/components/UploadCard.jsx`)
 * Supports:
 *   1. "Upload 3D CAD (.dae, .obj, .csv)"
 *   2. "Scan Paper Cutlist (.png, .jpg)" with camera / drag-and-drop & sample OCR trigger.
 */
export default function UploadCard({
  uploadMode,
  onSetUploadMode,
  isDragging,
  onSetIsDragging,
  uploadedFile,
  cadInputRef,
  ocrInputRef,
  onFileReceive,
  onDrop,
  onTriggerSampleOcr,
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      {/* Dual Upload Tabs */}
      <div className="grid grid-cols-2 gap-1.5 bg-zinc-900 p-1 rounded-xl mb-3">
        <button
          type="button"
          onClick={() => onSetUploadMode('cad')}
          className={`py-2 px-2 rounded-lg text-[11px] font-extrabold leading-tight flex flex-col items-center justify-center gap-1 transition-all ${
            uploadMode === 'cad'
              ? 'bg-[#FACC15] text-zinc-950 shadow-xs'
              : 'text-zinc-300 hover:text-white'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Upload 3D CAD (.dae, .obj, .csv)</span>
        </button>

        <button
          type="button"
          onClick={() => onSetUploadMode('ocr')}
          className={`py-2 px-2 rounded-lg text-[11px] font-extrabold leading-tight flex flex-col items-center justify-center gap-1 transition-all ${
            uploadMode === 'ocr'
              ? 'bg-[#FACC15] text-zinc-950 shadow-xs'
              : 'text-zinc-300 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Scan Paper Cutlist (.png, .jpg)</span>
        </button>
      </div>

      {/* Hidden file inputs for CAD and OCR Camera/Image */}
      <input
        ref={cadInputRef}
        type="file"
        accept=".dae,.obj,.csv,.skp,.json"
        className="hidden"
        onChange={(e) => onFileReceive(e.target.files?.[0])}
      />
      <input
        ref={ocrInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFileReceive(e.target.files?.[0])}
      />

      {/* Dropzone Area */}
      <div
        onClick={() =>
          uploadMode === 'ocr'
            ? ocrInputRef.current?.click()
            : cadInputRef.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault()
          onSetIsDragging(true)
        }}
        onDragLeave={() => onSetIsDragging(false)}
        onDrop={onDrop}
        className={`group cursor-pointer rounded-xl border-2 border-dashed transition-all px-4 py-5 flex flex-col items-center justify-center text-center ${
          isDragging
            ? 'border-[#EAB308] bg-yellow-50/70'
            : 'border-zinc-300 hover:border-[#FACC15] hover:bg-yellow-50/30'
        }`}
      >
        <div className="w-11 h-11 rounded-full bg-zinc-900 group-hover:bg-[#FACC15] border border-zinc-800 group-hover:border-[#EAB308] flex items-center justify-center mb-2.5 text-[#FACC15] group-hover:text-zinc-950 transition-colors shadow-xs">
          {uploadMode === 'ocr' ? (
            <Camera className="w-5 h-5 stroke-[2.2]" />
          ) : (
            <Upload className="w-5 h-5 stroke-[2.2]" />
          )}
        </div>
        <p className="text-[12.5px] font-extrabold tracking-wide text-zinc-900 uppercase">
          {uploadMode === 'ocr'
            ? 'DROP PAPER CUTLIST PHOTO HERE'
            : 'DROP 3D CAD FILES HERE'}
        </p>
        <p className="text-[11px] text-zinc-500 mt-1">
          {uploadedFile
            ? `Loaded: ${uploadedFile}`
            : uploadMode === 'ocr'
            ? 'Drag & drop .png / .jpg or tap to capture via camera'
            : 'Supports .dae, .obj, .csv, and SketchUp .skp'}
        </p>
      </div>

      {/* Quick OCR Demo Trigger Button for Immediate Inspection */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onTriggerSampleOcr}
          className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[#FACC15] text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Open OCR Vision Review Modal (Sample Scan)</span>
        </button>
      </div>
    </div>
  )
}
