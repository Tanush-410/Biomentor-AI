import React from 'react'

// Fixed (non-random) node layout -- deterministic so server/client render
// identically with no hydration mismatch. Coordinates are hand-placed
// across a 800x560 viewBox, weighted toward the right side where the
// graphic reads as the dominant visual element next to the hero copy.
const NODES = [
  { x: 560, y: 90, r: 5 }, { x: 660, y: 60, r: 3 }, { x: 720, y: 140, r: 4 },
  { x: 620, y: 180, r: 7 }, { x: 500, y: 150, r: 3 }, { x: 760, y: 230, r: 4 },
  { x: 680, y: 260, r: 6 }, { x: 590, y: 300, r: 3 }, { x: 450, y: 240, r: 4 },
  { x: 730, y: 360, r: 5 }, { x: 640, y: 400, r: 3 }, { x: 540, y: 380, r: 6 },
  { x: 430, y: 340, r: 3 }, { x: 690, y: 460, r: 4 }, { x: 580, y: 480, r: 3 },
  { x: 470, y: 440, r: 5 }, { x: 380, y: 200, r: 3 }, { x: 340, y: 320, r: 4 },
  { x: 760, y: 480, r: 3 }, { x: 620, y: 90, r: 3 }, { x: 500, y: 60, r: 3 },
]

const MAX_EDGE_DISTANCE = 150

function buildEdges(nodes) {
  const edges = []
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < MAX_EDGE_DISTANCE) {
        edges.push({ a: nodes[i], b: nodes[j], opacity: Math.max(0.06, 0.34 - distance / 700) })
      }
    }
  }
  return edges
}

const EDGES = buildEdges(NODES)

export default function ConstellationHero({ className = '' }) {
  return (
    <div className={`pointer-events-none relative ${className}`} aria-hidden="true">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_68%_38%,rgba(217,194,92,0.16),transparent_58%)]" />
      <svg viewBox="0 0 800 560" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d9c25c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#d9c25c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {EDGES.map((edge, index) => (
          <line
            key={`edge-${index}`}
            x1={edge.a.x}
            y1={edge.a.y}
            x2={edge.b.x}
            y2={edge.b.y}
            stroke="#d9c25c"
            strokeWidth="1"
            strokeOpacity={edge.opacity}
          />
        ))}

        {NODES.map((node, index) => (
          <g key={`node-${index}`} className="constellation-node" style={{ animationDelay: `${(index % 7) * 0.6}s` }}>
            <circle cx={node.x} cy={node.y} r={node.r * 4} fill="url(#nodeGlow)" opacity="0.35" />
            <circle cx={node.x} cy={node.y} r={node.r} fill="#d9c25c" />
          </g>
        ))}
      </svg>

      <style jsx>{`
        .constellation-node {
          transform-box: fill-box;
          transform-origin: center;
          animation: constellation-pulse 5.5s ease-in-out infinite;
        }
        @keyframes constellation-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          .constellation-node { animation: none; }
        }
      `}</style>
    </div>
  )
}
