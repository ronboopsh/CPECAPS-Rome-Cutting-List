import React, { useState } from 'react'

/**
 * Reusable <RomeLogo /> Component
 * - Supports dropping a custom PNG/JPG file at `logoPath` (e.g. "/logo.png")
 *   when `preferImage={true}`, with automatic fallback to the exact
 *   pixel-accurate "ROME MODULAR SYSTEMS" SVG replica.
 */
export default function RomeLogo({
  logoPath = '/logo.png',
  preferImage = false,
  variant = 'full', // 'full' | 'badge'
  className = 'h-12 w-auto',
}) {
  const [imgFailed, setImgFailed] = useState(false)

  if (preferImage && logoPath && !imgFailed) {
    return (
      <img
        src={logoPath}
        alt="Rome Modular Systems"
        onError={() => setImgFailed(true)}
        className={`object-contain select-none ${className}`}
      />
    )
  }

  if (variant === 'badge') {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none shrink-0 ${className}`}
        aria-label="Rome Cabinets Emblem"
      >
        <rect width="64" height="64" rx="12" fill="#050505" />
        <rect
          x="1"
          y="1"
          width="62"
          height="62"
          rx="11"
          stroke="#27272A"
          strokeWidth="1.5"
        />
        <rect x="8" y="7" width="48" height="4.5" rx="1.5" fill="#F5A623" />
        <rect x="8" y="52.5" width="48" height="4.5" rx="1.5" fill="#F5A623" />
        {/* 2x2 Four-Color Rounded Square Grid */}
        <rect x="13" y="15.5" width="17" height="15.5" rx="3.2" fill="#E6E632" />
        <rect x="34" y="15.5" width="17" height="15.5" rx="3.2" fill="#19E6E6" />
        <rect x="13" y="33" width="17" height="15.5" rx="3.2" fill="#19D119" />
        <rect x="34" y="33" width="17" height="15.5" rx="3.2" fill="#E61919" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 520 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 ${className}`}
      role="img"
      aria-label="ROME MODULAR SYSTEMS"
    >
      {/* Solid black background container */}
      <rect width="520" height="210" rx="14" fill="#050505" />
      <rect
        x="1.5"
        y="1.5"
        width="517"
        height="207"
        rx="12.5"
        stroke="#27272A"
        strokeWidth="2"
      />

      {/* Top thick horizontal golden-yellow bar */}
      <rect x="24" y="18" width="472" height="14" rx="2" fill="#F5A623" />

      {/* ============================================================
          CENTER ROW: Bold White "R" + 2x2 Grid "O" + Bold White "M" & "E"
         ============================================================ */}

      {/* Bold White "R" */}
      <path
        d="M 38 48 H 92 C 114 48 126 58 126 75 C 126 88 118 97 104 101 L 129 136 H 102 L 81 104 H 62 V 136 H 38 V 48 Z M 62 67 V 87 H 89 C 98 87 103 83 103 77 C 103 71 98 67 89 67 H 62 Z"
        fill="#FFFFFF"
      />

      {/* 2x2 Grid of 4 Rounded Squares acting as the "O" */}
      {/* Top-Left: Yellow (#E6E632) */}
      <rect x="148" y="48" width="41" height="40" rx="7" fill="#E6E632" />
      {/* Top-Right: Cyan (#19E6E6) */}
      <rect x="197" y="48" width="41" height="40" rx="7" fill="#19E6E6" />
      {/* Bottom-Left: Green (#19D119) */}
      <rect x="148" y="96" width="41" height="40" rx="7" fill="#19D119" />
      {/* Bottom-Right: Red (#E61919) */}
      <rect x="197" y="96" width="41" height="40" rx="7" fill="#E61919" />

      {/* Bold White "M" */}
      <path
        d="M 262 48 H 288 L 314 98 L 340 48 H 366 V 136 H 343 V 83 L 320 126 H 308 L 285 83 V 136 H 262 V 48 Z"
        fill="#FFFFFF"
      />

      {/* Bold White "E" */}
      <path
        d="M 392 48 H 478 V 68 H 416 V 82 H 470 V 101 H 416 V 116 H 480 V 136 H 392 V 48 Z"
        fill="#FFFFFF"
      />

      {/* Bottom thick horizontal golden-yellow bar */}
      <rect x="24" y="150" width="472" height="14" rx="2" fill="#F5A623" />

      {/* Bottom wide-tracked subtitle in white: "M O D U L A R   S Y S T E M S" */}
      <text
        x="265"
        y="189"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Inter, Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="18.5"
        letterSpacing="11.5"
      >
        MODULAR SYSTEMS
      </text>
    </svg>
  )
}
