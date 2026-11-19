import React from 'react'
import { Upload, Camera, FileCode2, Sparkles } from 'lucide-react'

/**
 * Dual-Mode Upload Card (`src/components/UploadCard.jsx`)
 * Compact left-sidebar intake widget supporting:
 *   1. "3D CAD (.dae, .obj, .csv)" -> passes File via `onModelUpload(file)` / `onFileReceive(file)`
 *   2. "OCR Cutlist (.png, .jpg)" with camera / drag-and-drop & sample OCR trigger.
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
  onModelUpload,
  onDrop,
  onTriggerSampleOcr,
}) {
  const handleSelectedFile = (file) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (['dae', 'obj'].includes(ext) && typeof onModelUpload === 'function') {
      onModelUpload(file)
    }
    if (typeof onFileReceive === 'function') {
      onFileReceive(file)
    }
  }

  const handleInternalDrop = (e) => {
    e.preventDefault()
    onSetIsDragging?.(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (['dae', 'obj'].includes(ext) && typeof onModelUpload === 'function') {
      onModelUpload(file)
    }
    if (typeof onDrop === 'function') {
      onDrop(e)
    } else if (typeof onFileReceive === 'function') {
      onFileReceive(file)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-3.5 min-h-[246px] flex flex-col justify-between transition-colors">
      {/* Compact Dual Upload Tabs */}
      <div className="grid grid-cols-2 gap-1 bg-[#111827] dark:bg-[#0B0D11] p-1 rounded-xl mb-2.5 border border-zinc-800">
        <button
          type="button"
          onClick={() => onSetUploadMode('cad')}
          className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-extrabold leading-tight flex items-center justify-center gap-1.5 transition-all ${
            uploadMode === 'cad'
              ? 'bg-[#FACC15] text-zinc-950 shadow-xs'
              : 'text-zinc-300 hover:text-white'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">3D CAD</span>
        </button>

        <button
          type="button"
          onClick={() => onSetUploadMode('ocr')}
          className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-extrabold leading-tight flex items-center justify-center gap-1.5 transition-all ${
            uploadMode === 'ocr'
              ? 'bg-[#FACC15] text-zinc-950 shadow-xs'
              : 'text-zinc-300 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">OCR Scan</span>
        </button>
      </div>

      {/* Hidden file inputs for CAD and OCR Camera/Image */}
      <input
        ref={cadInputRef}
        type="file"
        accept=".dae,.obj,.csv,.skp,.json"
        className="hidden"
        onChange={(e) => {
          handleSelectedFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={ocrInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleSelectedFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {/* Compact Dropzone Area */}
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
        onDrop={handleInternalDrop}
        className={`group cursor-pointer rounded-xl border-2 border-dashed transition-all px-3 py-5 flex-1 flex flex-col items-center justify-center text-center ${
          isDragging
            ? 'border-[#EAB308] bg-yellow-50/70 dark:bg-yellow-500/10'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-[#FACC15] dark:hover:border-[#FACC15] hover:bg-yellow-50/30 dark:hover:bg-zinc-800/60'
        }`}
      >
        <div className="w-9 h-9 rounded-full bg-[#111827] dark:bg-zinc-800 group-hover:bg-[#FACC15] border border-zinc-800 dark:border-zinc-700 group-hover:border-[#EAB308] flex items-center justify-center mb-1.5 text-[#FACC15] group-hover:text-zinc-950 transition-colors shadow-xs">
          {uploadMode === 'ocr' ? (
            <Camera className="w-4 h-4 stroke-[2.2]" />
          ) : (
            <Upload className="w-4 h-4 stroke-[2.2]" />
          )}
        </div>
        <p className="text-[11px] font-extrabold tracking-wide text-zinc-900 dark:text-zinc-100 uppercase">
          {uploadMode === 'ocr' ? 'Drop Paper Cutlist Photo' : 'Drop 3D CAD Files'}
        </p>
        <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-full">
          {uploadedFile
            ? `Loaded: ${uploadedFile}`
            : uploadMode === 'ocr'
            ? '.png, .jpg or camera capture'
            : '.dae, .obj, .csv'}
        </p>
      </div>

      {/* Quick OCR Sample Trigger */}
      <button
        type="button"
        onClick={onTriggerSampleOcr}
        className="mt-2 w-full py-1.5 px-2.5 rounded-xl bg-[#111827] dark:bg-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-800 border border-zinc-800 text-[#FACC15] text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Sample OCR Review Modal</span>
      </button>
    </div>
  )
}
