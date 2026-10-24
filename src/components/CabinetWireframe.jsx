import React from 'react'

/**
 * Pixel-accurate 3D Isometric Technical Wireframe of a Base Cabinet
 * with dimension callouts (750 mm width, 500 mm depth, 500 mm height,
 * 300 mm and 750 mm base/toe-kick callouts) and Industrial Black & Yellow
 * active cut-plane highlighting.
 */
export default function CabinetWireframe({
  unit = 'metric',
  zoom = 1,
  rotation = 0,
  selectedPart = null,
}) {
  const fmt = (mm) => {
    if (unit === 'metric') return `${mm} mm`
    const inches = (mm / 25.4).toFixed(1)
    return `${inches}"`
  }

  const isShelfSelected =
    selectedPart &&
    (selectedPart.part.toLowerCase().includes('shelf') ||
      selectedPart.part.toLowerCase().includes('shelves'))
  const isSideSelected =
    selectedPart && selectedPart.part.toLowerCase().includes('side')
  const isTopSelected =
    selectedPart && selectedPart.part.toLowerCase().includes('top')

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
      {/* Subtle engineering blueprint grid pattern */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #E4E4E7 1px, transparent 1px),
            linear-gradient(to bottom, #E4E4E7 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      <svg
        viewBox="0 0 420 350"
        className="w-full h-full max-h-[320px] transition-transform duration-300 ease-out"
        style={{
          transform: `scale(${zoom}) rotate(${rotation}deg)`,
        }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Standard dark charcoal arrowhead markers */}
          <marker
            id="dim-arrow-start"
            viewBox="0 0 8 8"
            refX="2"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 7 1 L 1 4 L 7 7 z" fill="#18181B" />
          </marker>
          <marker
            id="dim-arrow-end"
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 1 1 L 7 4 L 1 7 z" fill="#18181B" />
          </marker>

          {/* Industrial Yellow arrowhead markers for active boundary callouts */}
          <marker
            id="dim-arrow-yellow-start"
            viewBox="0 0 8 8"
            refX="2"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 7 1 L 1 4 L 7 7 z" fill="#CA8A04" />
          </marker>
          <marker
            id="dim-arrow-yellow-end"
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 1 1 L 7 4 L 1 7 z" fill="#CA8A04" />
          </marker>
        </defs>

        {/* ============================================================
            ACTIVE CUT PLANE HIGHLIGHT (SEMI-TRANSPARENT YELLOW + BOUNDARY)
           ============================================================ */}
        {isTopSelected && (
          <polygon
            points="215,42 325,100 205,160 95,102"
            fill="#FACC15"
            fillOpacity="0.38"
            stroke="#EAB308"
            strokeWidth="2.2"
          />
        )}
        {isSideSelected && (
          <>
            <polygon
              points="95,102 205,160 205,278 95,220"
              fill="#FACC15"
              fillOpacity="0.34"
              stroke="#EAB308"
              strokeWidth="2"
            />
            <polygon
              points="205,160 325,100 325,218 205,278"
              fill="#FACC15"
              fillOpacity="0.24"
              stroke="#EAB308"
              strokeWidth="1.8"
            />
          </>
        )}
        {isShelfSelected && (
          <>
            {/* Semi-transparent yellow cut-plane fill for active Shelf */}
            <polygon
              points="165,194 270,141 318,166 212,219"
              fill="#FACC15"
              fillOpacity="0.45"
              stroke="#EAB308"
              strokeWidth="2"
            />
            {/* Crisp yellow dimension boundary line around active shelf plane */}
            <polygon
              points="103,161 205,215 317,159 215,105"
              fill="#FEF08A"
              fillOpacity="0.28"
              stroke="#FACC15"
              strokeWidth="1.6"
              strokeDasharray="4 2"
            />
          </>
        )}

        {/* Hidden / Back interior carcass lines (subtle grey) */}
        <line
          x1="215"
          y1="42"
          x2="215"
          y2="160"
          stroke="#A1A1AA"
          strokeWidth="1.1"
          strokeDasharray="3 3"
        />
        <line
          x1="95"
          y1="220"
          x2="215"
          y2="160"
          stroke="#A1A1AA"
          strokeWidth="1.1"
          strokeDasharray="3 3"
        />
        <line
          x1="215"
          y1="160"
          x2="325"
          y2="218"
          stroke="#A1A1AA"
          strokeWidth="1.1"
          strokeDasharray="3 3"
        />

        {/* Top Panel Double-Line Thickness (18mm panel representation) */}
        <polygon
          points="215,42 325,100 205,160 95,102"
          stroke={isTopSelected ? '#CA8A04' : '#18181B'}
          strokeWidth="1.75"
          strokeLinejoin="round"
          fill="white"
          fillOpacity={isTopSelected ? '0.1' : '0.35'}
        />
        {/* Inner top rim / panel thickness lines */}
        <polyline
          points="95,109 205,167 325,107"
          stroke="#27272A"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        {/* Top panel inset seam line */}
        <line
          x1="152"
          y1="74"
          x2="262"
          y2="132"
          stroke="#52525B"
          strokeWidth="1.1"
        />

        {/* Left Side Panel (Depth side: 500 mm) */}
        <polygon
          points="95,102 205,160 205,278 95,220"
          stroke={isSideSelected ? '#CA8A04' : '#18181B'}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Left Side Panel thickness inner vertical edge */}
        <line
          x1="102"
          y1="106"
          x2="102"
          y2="224"
          stroke="#3F3F46"
          strokeWidth="1.15"
        />

        {/* Front-Right Open Carcass Bay (Width side: 750 mm) */}
        <polygon
          points="205,160 325,100 325,218 205,278"
          stroke="#18181B"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Right panel thickness inner edge */}
        <line
          x1="318"
          y1="104"
          x2="318"
          y2="222"
          stroke="#3F3F46"
          strokeWidth="1.2"
        />
        {/* Front-center vertical stile thickness */}
        <line
          x1="212"
          y1="164"
          x2="212"
          y2="274"
          stroke="#3F3F46"
          strokeWidth="1.2"
        />

        {/* Interior Horizontal Shelf in Front-Right Bay */}
        {/* Shelf front edge (double line for 18mm thickness) */}
        <line
          x1="212"
          y1="219"
          x2="318"
          y2="166"
          stroke={isShelfSelected ? '#EAB308' : '#18181B'}
          strokeWidth={isShelfSelected ? '2.5' : '1.5'}
        />
        <line
          x1="212"
          y1="224"
          x2="318"
          y2="171"
          stroke={isShelfSelected ? '#CA8A04' : '#3F3F46'}
          strokeWidth={isShelfSelected ? '1.8' : '1.15'}
        />
        {/* Shelf depth receding line */}
        <line
          x1="212"
          y1="219"
          x2="165"
          y2="194"
          stroke={isShelfSelected ? '#EAB308' : '#3F3F46'}
          strokeWidth={isShelfSelected ? '2' : '1.2'}
        />
        <line
          x1="165"
          y1="194"
          x2="270"
          y2="141"
          stroke={isShelfSelected ? '#EAB308' : '#52525B'}
          strokeWidth={isShelfSelected ? '2' : '1.1'}
        />

        {/* Interior Vertical Partition / Back Stiffener */}
        <line
          x1="265"
          y1="137"
          x2="265"
          y2="167"
          stroke="#52525B"
          strokeWidth="1.15"
        />
        <line
          x1="265"
          y1="197"
          x2="265"
          y2="241"
          stroke="#52525B"
          strokeWidth="1.15"
        />
        {/* Interior bottom floor depth line */}
        <line
          x1="212"
          y1="274"
          x2="165"
          y2="248"
          stroke="#52525B"
          strokeWidth="1.1"
        />

        {/* ============================================================
            BASE / TOE-KICK PLINTH STRUCTURE (300 mm & 750 mm sections)
           ============================================================ */}
        {/* Left side base extension down to floor */}
        <polyline
          points="95,220 95,248 150,277 150,249"
          stroke="#18181B"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        {/* Left base inner step / notch */}
        <polyline
          points="150,277 205,306 205,278"
          stroke="#18181B"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        {/* Recessed toe-kick horizontal detail on left */}
        <line
          x1="150"
          y1="268"
          x2="205"
          y2="297"
          stroke="#3F3F46"
          strokeWidth="1.15"
        />

        {/* Right front toe-kick plinth */}
        <polyline
          points="205,306 325,246 325,218"
          stroke="#18181B"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        {/* Inner toe-kick recess double line */}
        <line
          x1="205"
          y1="298"
          x2="318"
          y2="242"
          stroke="#3F3F46"
          strokeWidth="1.15"
        />

        {/* ============================================================
            DIMENSION CALLOUTS & EXTENSION LINES
           ============================================================ */}

        {/* 1. Top-Left Depth Callout: 500 mm */}
        <line
          x1="92"
          y1="99"
          x2="76"
          y2="90"
          stroke={isSideSelected ? '#EAB308' : '#71717A'}
          strokeWidth="1"
        />
        <line
          x1="212"
          y1="39"
          x2="196"
          y2="30"
          stroke={isSideSelected ? '#EAB308' : '#71717A'}
          strokeWidth="1"
        />
        <line
          x1="82"
          y1="93"
          x2="200"
          y2="34"
          stroke={isSideSelected ? '#CA8A04' : '#18181B'}
          strokeWidth="1.2"
          markerStart={
            isSideSelected ? 'url(#dim-arrow-yellow-start)' : 'url(#dim-arrow-start)'
          }
          markerEnd={
            isSideSelected ? 'url(#dim-arrow-yellow-end)' : 'url(#dim-arrow-end)'
          }
        />
        <g transform="translate(132, 56) rotate(-26.5)">
          <rect
            x="-28"
            y="-10"
            width="56"
            height="15"
            rx="3"
            fill={isSideSelected ? '#FEF9C3' : '#FFFFFF'}
            stroke={isSideSelected ? '#FACC15' : 'none'}
            strokeWidth="1"
            fillOpacity="0.95"
          />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            className="text-[11px] font-semibold fill-zinc-900"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {fmt(500)}
          </text>
        </g>

        {/* 2. Top-Right Width Callout: 750 mm (Active Yellow Boundary Line when Shelf/Top selected) */}
        <line
          x1="218"
          y1="39"
          x2="233"
          y2="30"
          stroke={isShelfSelected || isTopSelected ? '#EAB308' : '#71717A'}
          strokeWidth="1.1"
        />
        <line
          x1="328"
          y1="97"
          x2="343"
          y2="88"
          stroke={isShelfSelected || isTopSelected ? '#EAB308' : '#71717A'}
          strokeWidth="1.1"
        />
        <line
          x1="229"
          y1="33"
          x2="337"
          y2="91"
          stroke={isShelfSelected || isTopSelected ? '#CA8A04' : '#18181B'}
          strokeWidth={isShelfSelected || isTopSelected ? '1.5' : '1.15'}
          markerStart={
            isShelfSelected || isTopSelected
              ? 'url(#dim-arrow-yellow-start)'
              : 'url(#dim-arrow-start)'
          }
          markerEnd={
            isShelfSelected || isTopSelected
              ? 'url(#dim-arrow-yellow-end)'
              : 'url(#dim-arrow-end)'
          }
        />
        <g transform="translate(286, 55) rotate(28)">
          <rect
            x="-28"
            y="-10"
            width="56"
            height="15"
            rx="3"
            fill={isShelfSelected || isTopSelected ? '#FEF08A' : '#FFFFFF'}
            stroke={isShelfSelected || isTopSelected ? '#EAB308' : 'none'}
            strokeWidth="1"
            fillOpacity="0.95"
          />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            className="text-[11px] font-bold fill-zinc-900"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {fmt(750)}
          </text>
        </g>

        {/* 3. Right Vertical Height Callout: 500 mm */}
        <line
          x1="330"
          y1="100"
          x2="352"
          y2="100"
          stroke="#71717A"
          strokeWidth="0.9"
        />
        <line
          x1="330"
          y1="246"
          x2="352"
          y2="246"
          stroke="#71717A"
          strokeWidth="0.9"
        />
        <line
          x1="346"
          y1="104"
          x2="346"
          y2="242"
          stroke="#18181B"
          strokeWidth="1.15"
          markerStart="url(#dim-arrow-start)"
          markerEnd="url(#dim-arrow-end)"
        />
        <rect
          x="352"
          y="164"
          width="54"
          height="18"
          rx="3"
          fill="#FFFFFF"
          fillOpacity="0.95"
        />
        <text
          x="355"
          y="177"
          textAnchor="start"
          className="text-[11px] font-semibold fill-zinc-900"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {fmt(500)}
        </text>

        {/* 4. Bottom-Left Base / Toe-Kick Callout: 300 mm */}
        <line
          x1="95"
          y1="252"
          x2="82"
          y2="262"
          stroke="#71717A"
          strokeWidth="0.9"
        />
        <line
          x1="202"
          y1="308"
          x2="189"
          y2="318"
          stroke="#71717A"
          strokeWidth="0.9"
        />
        <line
          x1="88"
          y1="259"
          x2="192"
          y2="314"
          stroke="#18181B"
          strokeWidth="1.15"
          markerStart="url(#dim-arrow-start)"
          markerEnd="url(#dim-arrow-end)"
        />
        <g transform="translate(132, 294) rotate(28)">
          <rect
            x="-28"
            y="-9"
            width="56"
            height="15"
            rx="3"
            fill="#FFFFFF"
            fillOpacity="0.95"
          />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            className="text-[11px] font-semibold fill-zinc-900"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {fmt(300)}
          </text>
        </g>

        {/* 5. Bottom-Right Base / Toe-Kick Width Callout: 750 mm */}
        <line
          x1="208"
          y1="308"
          x2="220"
          y2="318"
          stroke="#71717A"
          strokeWidth="0.9"
        />
        <line
          x1="325"
          y1="250"
          x2="337"
          y2="260"
          stroke="#71717A"
          strokeWidth="0.9"
        />
        <line
          x1="217"
          y1="315"
          x2="332"
          y2="257"
          stroke="#18181B"
          strokeWidth="1.15"
          markerStart="url(#dim-arrow-start)"
          markerEnd="url(#dim-arrow-end)"
        />
        <g transform="translate(282, 293) rotate(-26.5)">
          <rect
            x="-28"
            y="-9"
            width="56"
            height="15"
            rx="3"
            fill="#FFFFFF"
            fillOpacity="0.95"
          />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            className="text-[11px] font-semibold fill-zinc-900"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {fmt(750)}
          </text>
        </g>
      </svg>
    </div>
  )
}
