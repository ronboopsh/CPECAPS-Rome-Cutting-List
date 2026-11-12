import React from 'react'
import { CheckCircle2, Sun, Moon } from 'lucide-react'
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
  theme = 'light',
  onToggleTheme,
  toastMessage,
  onNavClick,
  onOpenSplash,
  onTriggerToast,
  logoPath,
  preferCustomLogo,
}) {
  const isDark = theme === 'dark'

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
                onClick={() =>
                  item.label === 'Home' && onOpenSplash
                    ? onOpenSplash()
                    : onNavClick(item.label)
                }
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

          {/* Right Side: Interactive Light / Dark Mode Theme Toggle Button */}
          <div className="flex items-center gap-3">
            {toastMessage && (
              <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-zinc-950 bg-[#FACC15] px-3 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />
                <span>{toastMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Light and Dark Mode"
              className="flex items-center bg-zinc-950 p-0.5 rounded-full border border-zinc-700 hover:border-[#FACC15] transition-all cursor-pointer"
            >
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all ${
                  !isDark
                    ? 'bg-[#FACC15] text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-100 font-medium'
                }`}
              >
                <Sun className="w-3.5 h-3.5 stroke-[2.3]" />
                <span>Light</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all ${
                  isDark
                    ? 'bg-[#FACC15] text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-100 font-medium'
                }`}
              >
                <Moon className="w-3.5 h-3.5 stroke-[2.3]" />
                <span>Dark</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TIER 2: Trimmed Main Header Banner (Logo + "ROME CABINETS" + "help") */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 transition-colors">
        <div className="max-w-[1680px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between gap-2">
          {/* Left Side: Official Rome Modular Systems Logo + Prominent "ROME CABINETS" Typography */}
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
            <button
              type="button"
              onClick={onOpenSplash}
              className="flex items-baseline gap-2.5 text-left cursor-pointer focus:outline-none"
            >
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-100 uppercase transition-colors">
                Rome{' '}
                <span className="bg-[#FACC15] px-2 py-0.5 rounded text-zinc-950">
                  Cabinets
                </span>
              </h1>
            </button>
          </div>

          {/* Right Side: Minimal "help" link */}
          <div className="pr-2">
            <button
              type="button"
              onClick={() =>
                onTriggerToast('Click any cutting list row or 3D panel to inspect cut plane')
              }
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-[#FACC15] hover:underline decoration-[#FACC15] decoration-2 underline-offset-2 transition-colors font-medium"
            >
              help
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
