import React from 'react'
import { CheckCircle2, UserCheck } from 'lucide-react'
import RomeLogo from './RomeLogo'

const TOP_NAV_ITEMS = [
  { label: 'Home', hasDropdown: false },
  { label: 'Browse', hasDropdown: true },
  { label: 'Tools', hasDropdown: true },
  { label: 'Data', hasDropdown: true },
  { label: 'More', hasDropdown: true },
  { label: 'Help', hasDropdown: false },
]

export default function Header({
  unit,
  onSetUnit,
  loggedIn,
  onToggleLogin,
  toastMessage,
  onNavClick,
  onOpenSplash,
  partsCount,
  totalPiecesCount,
  inventoryCount,
  onTriggerToast,
  logoPath,
  preferCustomLogo,
}) {
  return (
    <header className="w-full shadow-xs">
      {/* TIER 1: Utility & Navigation Bar (Solid Pitch Black / Dark Charcoal) */}
      <div className="bg-[#18181B] text-zinc-100 border-b border-zinc-800">
        <div className="max-w-[1680px] mx-auto px-4 lg:px-6 h-11 flex items-center justify-between text-[13px]">
          {/* Left Side: Horizontal Navigation Menu */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {TOP_NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavClick(item.label)}
                className="px-2.5 py-1 rounded text-zinc-200 hover:text-[#FACC15] hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-1.5"
              >
                {item.label === 'Home' && (
                  <RomeLogo variant="badge" className="w-4 h-4" />
                )}
                <span>{item.label}</span>
                {item.hasDropdown && (
                  <span className="text-[11px] text-zinc-400 group-hover:text-[#FACC15]">
                    ▾
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right Side: Workshop Account + Black & Yellow Unit Pill Switch */}
          <div className="flex items-center gap-4">
            {toastMessage && (
              <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-zinc-950 bg-[#FACC15] px-3 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />
                <span>{toastMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleLogin}
              className="text-xs sm:text-[13px] font-medium text-zinc-300 hover:text-[#FACC15] transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#FACC15]" />
              <span>
                {loggedIn ? 'Rome Cabinets Portal' : 'Login to Workshop Account'}
              </span>
            </button>

            <span className="text-zinc-700 hidden sm:inline">|</span>

            {/* Integrated Imperial / Metric Pill Switch in Black & Yellow */}
            <div className="flex items-center bg-zinc-950 p-0.5 rounded-full border border-zinc-700">
              <button
                type="button"
                onClick={() => onSetUnit('imperial')}
                className={`px-3 py-0.5 rounded-full text-xs transition-all ${
                  unit === 'imperial'
                    ? 'bg-[#FACC15] text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-100 font-medium'
                }`}
              >
                Imperial
              </button>
              <button
                type="button"
                onClick={() => onSetUnit('metric')}
                className={`px-3 py-0.5 rounded-full text-xs transition-all ${
                  unit === 'metric'
                    ? 'bg-[#FACC15] text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-100 font-medium'
                }`}
              >
                Metric
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TIER 2: Main Header Banner (Branding & Status Strip with <RomeLogo />) */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1680px] mx-auto px-4 lg:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Left Side: Official Rome Modular Systems Logo + Prominent "Rome Cabinets" Typography */}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              title="Open Carpenter Splash Screen"
              onClick={onOpenSplash}
              className="rounded-lg overflow-hidden shadow-xs hover:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
            >
              <RomeLogo
                logoPath={logoPath}
                preferImage={preferCustomLogo}
                variant="full"
                className="h-12 w-auto"
              />
            </button>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 uppercase">
                Rome{' '}
                <span className="bg-[#FACC15] px-2 py-0.5 rounded text-zinc-950">
                  Cabinets
                </span>
              </h1>
              <span className="hidden md:inline-block text-[11px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-300 rounded px-1.5 py-0.5">
                CNC · CAD · OCR v2.5
              </span>
            </div>
          </div>

          {/* Right Side: Two-Line Metadata and Status Block */}
          <div className="sm:text-right">
            <p className="text-[13.5px] font-bold text-zinc-900 tracking-tight">
              Automated Cutting List &amp; Shop-Floor Coordinator
            </p>
            <div className="text-xs text-zinc-500 font-medium mt-0.5 flex flex-wrap sm:justify-end items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-zinc-800 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#EAB308] inline-block" />
                Active Session
              </span>
              <span className="text-zinc-300">|</span>
              <span className="font-semibold text-zinc-700">
                {partsCount} Rows ({totalPiecesCount} Pcs)
              </span>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                onClick={() =>
                  onTriggerToast(
                    `Shop Efficiency: 82% Yield across ${inventoryCount} Stock Sheets`
                  )
                }
                className="hover:text-zinc-950 hover:underline decoration-[#FACC15] decoration-2 underline-offset-2 transition-colors"
              >
                Shop Statistics
              </button>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                onClick={() =>
                  onTriggerToast('Click any cutting list row to inspect 3D cut plane')
                }
                className="hover:text-zinc-950 hover:underline decoration-[#FACC15] decoration-2 underline-offset-2 transition-colors"
              >
                Help
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
