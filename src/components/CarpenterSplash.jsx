import React, { useEffect, useState } from 'react'
import RomeLogo from './RomeLogo'

/**
 * Interactive Carpenter Home / Splash Screen
 * - Full-viewport (100vw x 100vh) landing screen with industrial blueprint grid,
 *   warm yellow radial glow, ROME MODULAR SYSTEMS centerpiece, and 8 vector
 *   outline-only carpentry tools flying in from all directions.
 * - Clicking anywhere or pressing any key triggers a smooth 500ms exit transition.
 */
export default function CarpenterSplash({
  onEnterWorkshop,
  logoPath,
  preferCustomLogo = false,
  partsCount = 13,
}) {
  const [isExiting, setIsExiting] = useState(false)

  const triggerExit = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      onEnterWorkshop?.()
    }, 480)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Alt') return
      triggerExit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExiting])

  // Generate 24 teeth path points for the Circular Saw Blade outline
  const sawTeethPoints = Array.from({ length: 24 }, (_, i) => {
    const angle1 = (i * 15 * Math.PI) / 180
    const angle2 = ((i * 15 + 9) * Math.PI) / 180
    const rOuter = 74
    const rInner = 62
    const x1 = (90 + rOuter * Math.cos(angle1)).toFixed(1)
    const y1 = (90 + rOuter * Math.sin(angle1)).toFixed(1)
    const x2 = (90 + rInner * Math.cos(angle2)).toFixed(1)
    const y2 = (90 + rInner * Math.sin(angle2)).toFixed(1)
    return `${i === 0 ? 'M' : 'L'} ${x1} ${y1} L ${x2} ${y2}`
  }).join(' ') + ' Z'

  return (
    <div
      onClick={triggerExit}
      role="button"
      tabIndex={0}
      aria-label="Click anywhere to enter Rome Cabinets Workshop"
      className={`fixed inset-0 z-50 w-screen h-screen overflow-hidden cursor-pointer select-none flex flex-col items-center justify-between p-6 md:p-10 transition-all duration-500 ease-out ${
        isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{ backgroundColor: '#0B0D11' }}
    >
      {/* ============================================================
          TECHNICAL DRAFTING BLUEPRINT GRID & RADIAL YELLOW GLOW
         ============================================================ */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(250, 204, 21, 0.14) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(250, 204, 21, 0.14) 1px, transparent 1px),
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
        }}
      />

      {/* Warm industrial yellow radial spotlight behind centerpiece */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(250, 204, 21, 0.14) 0%, rgba(234, 179, 8, 0.05) 35%, rgba(11, 13, 17, 0.92) 72%)',
        }}
      />

      {/* Corner CAD Blueprint Registration Crosshairs */}
      <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-[#FACC15]/50 pointer-events-none" />
      <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-[#FACC15]/50 pointer-events-none" />
      <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2 border-[#FACC15]/50 pointer-events-none" />
      <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2 border-[#FACC15]/50 pointer-events-none" />

      {/* ============================================================
          8 FLYING VECTOR OUTLINE CARPENTRY TOOLS (fill="none")
         ============================================================ */}

      {/* 1. TOP-LEFT: Circular Saw Blade (with rotation & Ø250mm callout) */}
      <div className="absolute top-[6%] left-[5%] md:left-[7%] w-36 h-36 md:w-44 md:h-44 pointer-events-none tool-fly-top-left">
        <div className="w-full h-full tool-idle-saw">
          <svg viewBox="0 0 180 180" fill="none" className="w-full h-full">
            {/* Outer dimension reference circle */}
            <circle
              cx="90"
              cy="90"
              r="82"
              stroke="#52525B"
              strokeWidth="0.9"
              strokeDasharray="3 3"
            />
            {/* 24-Tooth Carbide Saw Blade Outline */}
            <path
              d={sawTeethPoints}
              stroke="#FACC15"
              strokeWidth="1.6"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Expansion slots & gullets */}
            <circle cx="90" cy="90" r="54" stroke="#E4E4E7" strokeWidth="1" strokeDasharray="6 4" />
            <line x1="90" y1="28" x2="90" y2="44" stroke="#FACC15" strokeWidth="1.3" />
            <line x1="90" y1="136" x2="90" y2="152" stroke="#FACC15" strokeWidth="1.3" />
            <line x1="28" y1="90" x2="44" y2="90" stroke="#FACC15" strokeWidth="1.3" />
            <line x1="136" y1="90" x2="152" y2="90" stroke="#FACC15" strokeWidth="1.3" />
            {/* Center Arbor Bore & Pin Holes */}
            <circle cx="90" cy="90" r="16" stroke="#FACC15" strokeWidth="1.8" />
            <circle cx="90" cy="90" r="6" stroke="#E4E4E7" strokeWidth="1.2" />
            <circle cx="70" cy="90" r="2.5" stroke="#E4E4E7" strokeWidth="1.1" />
            <circle cx="110" cy="90" r="2.5" stroke="#E4E4E7" strokeWidth="1.1" />
            {/* Technical CAD Label */}
            <text
              x="90"
              y="174"
              textAnchor="middle"
              fill="#FACC15"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="1"
            >
              BLADE Ø250×3.2mm · 24T
            </text>
          </svg>
        </div>
      </div>

      {/* 2. BOTTOM-LEFT: Claw Hammer (Outline with dimension ticks) */}
      <div className="absolute bottom-[8%] left-[5%] md:left-[7%] w-40 h-40 md:w-48 md:h-48 pointer-events-none tool-fly-bottom-left">
        <div className="w-full h-full tool-idle-float">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <g transform="rotate(-28 100 100)">
              {/* Forged Steel Hammer Head & Curved Claw Outline */}
              <path
                d="M 55 52 L 88 52 L 94 46 L 112 46 L 116 52 C 134 52 148 59 156 72 C 144 65 132 64 120 66 L 114 74 L 92 74 L 88 68 L 68 68 L 68 72 L 55 72 Z"
                stroke="#FACC15"
                strokeWidth="1.7"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Striking face bevel lines */}
              <line x1="55" y1="56" x2="55" y2="68" stroke="#E4E4E7" strokeWidth="1.4" />
              <line x1="62" y1="52" x2="62" y2="72" stroke="#FACC15" strokeWidth="1.1" />
              {/* Hickory / Fiberglass Handle Outline */}
              <path
                d="M 95 74 L 92 162 C 92 168 96 172 103 172 C 110 172 114 168 114 162 L 111 74"
                stroke="#E4E4E7"
                strokeWidth="1.6"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Grip Ribs & Lanyard Hole */}
              <rect x="94" y="126" width="18" height="34" rx="3" stroke="#FACC15" strokeWidth="1.2" />
              <line x1="94" y1="135" x2="112" y2="135" stroke="#FACC15" strokeWidth="1" />
              <line x1="94" y1="144" x2="112" y2="144" stroke="#FACC15" strokeWidth="1" />
              <line x1="94" y1="153" x2="112" y2="153" stroke="#FACC15" strokeWidth="1" />
              <circle cx="103" cy="165" r="2.5" stroke="#E4E4E7" strokeWidth="1.1" />
              {/* CAD Dimension Tick Line */}
              <line x1="42" y1="46" x2="42" y2="172" stroke="#71717A" strokeWidth="0.9" strokeDasharray="2 2" />
              <line x1="38" y1="46" x2="46" y2="46" stroke="#FACC15" strokeWidth="1.1" />
              <line x1="38" y1="172" x2="46" y2="172" stroke="#FACC15" strokeWidth="1.1" />
              <text
                x="35"
                y="112"
                textAnchor="end"
                fill="#FACC15"
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
              >
                325mm
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* 3. TOP-RIGHT: Carpenter's Framing L-Square (with metric tick marks & 90° callout) */}
      <div className="absolute top-[6%] right-[5%] md:right-[7%] w-40 h-40 md:w-48 md:h-48 pointer-events-none tool-fly-top-right">
        <div className="w-full h-full tool-idle-float">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <g transform="rotate(12 100 100)">
              {/* L-Square Outer & Inner Perimeter */}
              <path
                d="M 36 32 H 166 V 58 H 64 V 168 H 36 V 32 Z"
                stroke="#FACC15"
                strokeWidth="1.7"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Ruler Graduation Tick Marks (Top Blade) */}
              {[50, 62, 74, 86, 98, 110, 122, 134, 146, 158].map((x, idx) => (
                <line
                  key={`ht-${x}`}
                  x1={x}
                  y1="32"
                  x2={x}
                  y2={idx % 2 === 0 ? '42' : '38'}
                  stroke="#E4E4E7"
                  strokeWidth="1.1"
                />
              ))}
              {/* Ruler Graduation Tick Marks (Vertical Tongue) */}
              {[70, 82, 94, 106, 118, 130, 142, 154].map((y, idx) => (
                <line
                  key={`vt-${y}`}
                  x1="36"
                  y1={y}
                  x2={idx % 2 === 0 ? '46' : '42'}
                  stroke="#E4E4E7"
                  strokeWidth="1.1"
                />
              ))}
              {/* 90-Degree Right Angle Inspection Callout */}
              <path
                d="M 64 78 H 84 V 58"
                stroke="#FACC15"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              <text
                x="92"
                y="76"
                fill="#FACC15"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                90.0° SQUARE
              </text>
              <circle cx="50" cy="45" r="3.5" stroke="#E4E4E7" strokeWidth="1.1" />
            </g>
          </svg>
        </div>
      </div>

      {/* 4. RIGHT MIDDLE: Hand Saw (Toothed tapered blade + D-Handle outline) */}
      <div className="absolute top-[41%] right-[3%] md:right-[5%] w-44 h-36 md:w-56 md:h-44 pointer-events-none tool-fly-right">
        <div className="w-full h-full tool-idle-float">
          <svg viewBox="0 0 240 150" fill="none" className="w-full h-full">
            <g transform="rotate(-14 120 75)">
              {/* Tapered Saw Blade Spine & Toothed Edge */}
              <path
                d="M 18 62 L 172 48 L 172 96 L 164 90 L 156 95 L 148 89 L 140 94 L 132 88 L 124 93 L 116 87 L 108 92 L 100 86 L 92 91 L 84 85 L 76 90 L 68 84 L 60 89 L 52 83 L 44 88 L 36 82 L 28 87 L 18 82 Z"
                stroke="#E4E4E7"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Carpenter D-Handle Outline */}
              <path
                d="M 172 42 L 214 38 C 222 38 226 44 226 52 L 222 102 C 220 110 212 114 202 112 L 172 102 Z"
                stroke="#FACC15"
                strokeWidth="1.8"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Inner D-Grip Cutout */}
              <path
                d="M 186 55 L 208 53 L 206 94 L 186 90 Z"
                stroke="#FACC15"
                strokeWidth="1.3"
                strokeLinejoin="round"
                fill="none"
              />
              {/* 3 Split-Nut Handle Screws */}
              <circle cx="179" cy="56" r="2.5" stroke="#E4E4E7" strokeWidth="1.2" />
              <circle cx="179" cy="72" r="2.5" stroke="#E4E4E7" strokeWidth="1.2" />
              <circle cx="179" cy="88" r="2.5" stroke="#E4E4E7" strokeWidth="1.2" />
              <text
                x="95"
                y="38"
                textAnchor="middle"
                fill="#FACC15"
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
              >
                CROSSCUT · 550mm · 7 TPI
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* 5. BOTTOM-RIGHT: Tape Measure (Case outline + extended graduated blade) */}
      <div className="absolute bottom-[8%] right-[5%] md:right-[7%] w-44 h-36 md:w-52 md:h-44 pointer-events-none tool-fly-bottom-right">
        <div className="w-full h-full tool-idle-float">
          <svg viewBox="0 0 220 160" fill="none" className="w-full h-full">
            {/* Extended Measuring Blade & End Hook */}
            <path
              d="M 18 106 V 126 H 24 V 116 H 116 V 104 H 18 Z"
              stroke="#FACC15"
              strokeWidth="1.6"
              strokeLinejoin="round"
              fill="none"
            />
            {[30, 40, 50, 60, 70, 80, 90, 100, 110].map((x, idx) => (
              <line
                key={`tm-${x}`}
                x1={x}
                y1="104"
                x2={x}
                y2={idx % 2 === 0 ? '111' : '108'}
                stroke="#E4E4E7"
                strokeWidth="1.1"
              />
            ))}
            {/* Tape Measure Outer Case */}
            <path
              d="M 116 116 V 64 C 116 44 132 32 156 32 H 182 C 198 32 208 44 208 62 V 104 C 208 112 202 116 192 116 H 116 Z"
              stroke="#FACC15"
              strokeWidth="1.8"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Thumb Lock Lever */}
            <path
              d="M 110 68 H 122 V 86 H 110 Z"
              stroke="#E4E4E7"
              strokeWidth="1.4"
              fill="none"
            />
            {/* Center Spool Ring & Belt Clip */}
            <circle cx="162" cy="76" r="22" stroke="#E4E4E7" strokeWidth="1.4" />
            <circle cx="162" cy="76" r="10" stroke="#FACC15" strokeWidth="1.2" strokeDasharray="3 2" />
            <text
              x="66"
              y="96"
              textAnchor="middle"
              fill="#FACC15"
              fontSize="8.5"
              fontFamily="JetBrains Mono, monospace"
            >
              8.0m / 26ft
            </text>
          </svg>
        </div>
      </div>

      {/* 6. LEFT MIDDLE: Wood Chisel (Bevel-edge cabinetmaker's chisel outline) */}
      <div className="absolute top-[42%] left-[3%] md:left-[5%] w-44 h-36 md:w-52 md:h-40 pointer-events-none tool-fly-left">
        <div className="w-full h-full tool-idle-float">
          <svg viewBox="0 0 230 140" fill="none" className="w-full h-full">
            <g transform="rotate(14 115 70)">
              {/* Bevel-Edge Steel Blade */}
              <polygon
                points="20,54 106,54 106,82 20,82"
                stroke="#E4E4E7"
                strokeWidth="1.6"
                strokeLinejoin="round"
                fill="none"
              />
              {/* 25° Cutting Bevel & Side Bevel Lines */}
              <line x1="32" y1="54" x2="32" y2="82" stroke="#FACC15" strokeWidth="1.4" />
              <line x1="20" y1="54" x2="32" y2="60" stroke="#FACC15" strokeWidth="1.1" />
              <line x1="20" y1="82" x2="32" y2="76" stroke="#FACC15" strokeWidth="1.1" />
              <line x1="32" y1="60" x2="106" y2="60" stroke="#71717A" strokeWidth="1" />
              <line x1="32" y1="76" x2="106" y2="76" stroke="#71717A" strokeWidth="1" />
              {/* Bolster & Brass Ferrule */}
              <rect x="106" y="50" width="14" height="36" rx="2" stroke="#FACC15" strokeWidth="1.6" />
              {/* Turned Ash / Beech Handle & Hoop Ring */}
              <path
                d="M 120 52 C 142 44 182 44 204 52 L 204 84 C 182 92 142 92 120 84 Z"
                stroke="#FACC15"
                strokeWidth="1.7"
                fill="none"
              />
              <rect x="204" y="53" width="7" height="30" rx="1.5" stroke="#E4E4E7" strokeWidth="1.4" />
              <text
                x="65"
                y="44"
                textAnchor="middle"
                fill="#FACC15"
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
              >
                CHISEL 25mm · 25°
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* 7. TOP CENTER-LEFT/RIGHT: Vernier Caliper / Precision Gauge (flying in from top) */}
      <div className="hidden lg:block absolute top-[4%] left-[31%] w-44 h-28 pointer-events-none tool-fly-top">
        <div className="w-full h-full tool-idle-float">
          <svg viewBox="0 0 220 110" fill="none" className="w-full h-full">
            {/* Main Beam */}
            <rect x="24" y="34" width="176" height="16" stroke="#E4E4E7" strokeWidth="1.4" />
            {/* Fixed External & Internal Jaws */}
            <path d="M 24 34 L 14 14 L 28 14 L 28 34" stroke="#FACC15" strokeWidth="1.5" />
            <path d="M 24 50 L 24 92 L 36 80 L 36 50" stroke="#FACC15" strokeWidth="1.5" />
            {/* Sliding Vernier Carriage & Jaws */}
            <path d="M 74 30 H 122 V 54 H 74 Z" stroke="#FACC15" strokeWidth="1.6" />
            <path d="M 74 34 L 64 14 L 78 14 L 78 34" stroke="#FACC15" strokeWidth="1.5" />
            <path d="M 74 54 L 74 92 L 86 80 L 86 54" stroke="#FACC15" strokeWidth="1.5" />
            <circle cx="98" cy="24" r="3.5" stroke="#E4E4E7" strokeWidth="1.2" />
            {/* Dimension between jaws */}
            <line x1="36" y1="74" x2="74" y2="74" stroke="#FACC15" strokeWidth="1.1" strokeDasharray="2 2" />
            <text
              x="55"
              y="88"
              textAnchor="middle"
              fill="#FACC15"
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
            >
              18.0mm
            </text>
          </svg>
        </div>
      </div>

      {/* 8. BOTTOM CENTER-RIGHT: Plunge Router / CNC Spindle Outline (flying in from bottom) */}
      <div className="hidden lg:block absolute bottom-[4%] right-[29%] w-40 h-36 pointer-events-none tool-fly-bottom">
        <div className="w-full h-full tool-idle-float">
          <svg viewBox="0 0 180 150" fill="none" className="w-full h-full">
            {/* Motor Housing Cylinder */}
            <rect x="62" y="18" width="56" height="58" rx="6" stroke="#FACC15" strokeWidth="1.6" />
            <line x1="70" y1="30" x2="110" y2="30" stroke="#E4E4E7" strokeWidth="1.1" />
            <line x1="70" y1="38" x2="110" y2="38" stroke="#E4E4E7" strokeWidth="1.1" />
            {/* Left & Right Ergonomic Plunge Handles */}
            <path d="M 62 42 L 36 36 C 28 36 26 54 34 58 L 62 62" stroke="#E4E4E7" strokeWidth="1.5" />
            <path d="M 118 42 L 144 36 C 152 36 154 54 146 58 L 118 62" stroke="#E4E4E7" strokeWidth="1.5" />
            {/* Twin Plunge Guide Columns */}
            <line x1="70" y1="76" x2="70" y2="112" stroke="#E4E4E7" strokeWidth="2" />
            <line x1="110" y1="76" x2="110" y2="112" stroke="#E4E4E7" strokeWidth="2" />
            {/* Collet Chuck & Straight Router Bit */}
            <path d="M 83 76 H 97 L 94 94 H 86 Z" stroke="#FACC15" strokeWidth="1.4" />
            <rect x="86" y="94" width="8" height="26" stroke="#FACC15" strokeWidth="1.5" />
            {/* Base Plate */}
            <rect x="46" y="112" width="88" height="10" rx="2" stroke="#FACC15" strokeWidth="1.7" />
            <text
              x="90"
              y="138"
              textAnchor="middle"
              fill="#FACC15"
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
            >
              CNC ROUTER · 24,000 RPM
            </text>
          </svg>
        </div>
      </div>

      {/* ============================================================
          TOP WORKSHOP TELEMETRY STRIP
         ============================================================ */}
      <div className="relative z-10 flex items-center gap-3 text-[11px] font-mono tracking-widest uppercase text-zinc-400 border border-zinc-800 bg-zinc-950/80 px-4 py-1.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-[#FACC15] animate-pulse" />
        <span className="text-zinc-200 font-semibold">ROME WORKSHOP OS v2.4</span>
        <span className="text-zinc-700">|</span>
        <span>{partsCount} PARTS QUEUED</span>
        <span className="hidden sm:inline text-zinc-700">|</span>
        <span className="hidden sm:inline text-[#FACC15]">CAD · CAM READY</span>
      </div>

      {/* ============================================================
          CENTERPIECE: ROME MODULAR SYSTEMS LOGO & TITLE
         ============================================================ */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl px-4 my-auto">
        {/*Glowing frame around the ROME MODULAR SYSTEMS Logo */}
        <div className="p-2 md:p-3 rounded-2xl bg-zinc-950/90 border-2 border-[#FACC15]/80 shadow-[0_0_60px_-12px_rgba(250,204,21,0.35)] mb-7 transform hover:scale-[1.02] transition-transform duration-300">
          <RomeLogo
            logoPath={logoPath}
            preferImage={preferCustomLogo}
            variant="full"
            className="w-[290px] sm:w-[390px] md:w-[460px] h-auto"
          />
        </div>

        {/* Main Industrial Subtitle */}
        <h1 className="text-sm sm:text-base md:text-lg font-extrabold tracking-[0.22em] text-zinc-100 uppercase">
          AUTOMATED CUTTING LIST &amp; SHOP-FLOOR COORDINATOR
        </h1>

        <div className="w-28 h-1 bg-[#FACC15] rounded-full my-4" />

        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed font-medium">
          Precision panel nesting, 3D isometric cabinet inspection, and real-time sheet stock
          tracking for modular carpentry workshops.
        </p>
      </div>

      {/* ============================================================
          BOTTOM PULSING ENTRY PROMPT
         ============================================================ */}
      <div className="relative z-10 flex flex-col items-center gap-2 pb-2">
        <div className="px-5 py-2.5 rounded-xl border border-[#FACC15]/60 bg-[#FACC15]/10 hover:bg-[#FACC15] text-[#FACC15] hover:text-zinc-950 font-mono text-xs sm:text-sm font-bold tracking-[0.18em] uppercase transition-all duration-200 animate-pulse">
          [ CLICK ANYWHERE TO ENTER WORKSHOP ]
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Or press any key to launch shop-floor coordinator
        </span>
      </div>
    </div>
  )
}
