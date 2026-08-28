import React, { useEffect, useRef } from 'react'

// Fixed (non-random) node layout -- deterministic so server/client render
// identically with no hydration mismatch. Spread across a wide viewBox so
// the graphic reads as a full-page backdrop rather than a corner
// decoration; layer 1-3 give the parallax effect below some depth (layer 1
// drifts the most, as if it's closest to the viewer).
const LAYER_1 = [
  { x: 180, y: 120, r: 3 }, { x: 620, y: 90, r: 4 }, { x: 980, y: 150, r: 3 },
  { x: 1340, y: 100, r: 4 }, { x: 90, y: 420, r: 3 }, { x: 480, y: 380, r: 5 },
  { x: 860, y: 440, r: 3 }, { x: 1220, y: 400, r: 4 }, { x: 1500, y: 460, r: 3 },
  { x: 260, y: 650, r: 4 }, { x: 640, y: 700, r: 3 }, { x: 1020, y: 660, r: 5 },
  { x: 1380, y: 720, r: 3 }, { x: 140, y: 860, r: 3 }, { x: 760, y: 900, r: 4 },
  { x: 1160, y: 880, r: 3 },
]

const LAYER_2 = [
  { x: 60, y: 240, r: 3 }, { x: 380, y: 200, r: 4 }, { x: 720, y: 240, r: 3 },
  { x: 1060, y: 260, r: 4 }, { x: 1420, y: 220, r: 3 }, { x: 220, y: 520, r: 4 },
  { x: 560, y: 540, r: 3 }, { x: 940, y: 560, r: 4 }, { x: 1300, y: 520, r: 3 },
  { x: 40, y: 740, r: 3 }, { x: 400, y: 780, r: 4 }, { x: 800, y: 760, r: 3 },
  { x: 1180, y: 790, r: 4 }, { x: 1500, y: 750, r: 3 },
]

const LAYER_3 = [
  { x: 300, y: 60, r: 2 }, { x: 700, y: 40, r: 3 }, { x: 1100, y: 60, r: 2 },
  { x: 1460, y: 340, r: 3 }, { x: 100, y: 320, r: 2 }, { x: 500, y: 300, r: 3 },
  { x: 900, y: 320, r: 2 }, { x: 1240, y: 620, r: 3 }, { x: 320, y: 600, r: 2 },
  { x: 680, y: 620, r: 3 }, { x: 1040, y: 600, r: 2 }, { x: 180, y: 800, r: 3 },
  { x: 560, y: 840, r: 2 }, { x: 960, y: 820, r: 3 }, { x: 1340, y: 850, r: 2 },
]

const MAX_EDGE_DISTANCE = 190
const VIEW_W = 1560
const VIEW_H = 940

function buildEdges(nodes) {
  const edges = []
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < MAX_EDGE_DISTANCE) {
        edges.push({ a: nodes[i], b: nodes[j], opacity: Math.max(0.05, 0.3 - distance / 800) })
      }
    }
  }
  return edges
}

const LAYERS = [
  { nodes: LAYER_1, edges: buildEdges(LAYER_1), parallax: 26, key: 'l1' },
  { nodes: LAYER_2, edges: buildEdges(LAYER_2), parallax: 14, key: 'l2' },
  { nodes: LAYER_3, edges: buildEdges(LAYER_3), parallax: 6, key: 'l3' },
]

export default function ConstellationHero({ className = '' }) {
  const layerRefs = useRef([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let frame = null
    const handlePointerMove = (event) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1
      const ny = (event.clientY / window.innerHeight) * 2 - 1
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        layerRefs.current.forEach((el, index) => {
          if (!el) return
          const strength = LAYERS[index].parallax
          el.style.transform = `translate3d(${-nx * strength}px, ${-ny * strength}px, 0)`
        })
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(217,194,92,0.14),transparent_45%),radial-gradient(circle_at_78%_65%,rgba(217,194,92,0.10),transparent_50%)]" />
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d9c25c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#d9c25c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {LAYERS.map((layer, layerIndex) => (
          <g
            key={layer.key}
            ref={(el) => { layerRefs.current[layerIndex] = el }}
            style={{ transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            {layer.edges.map((edge, index) => (
              <line
                key={`${layer.key}-edge-${index}`}
                x1={edge.a.x}
                y1={edge.a.y}
                x2={edge.b.x}
                y2={edge.b.y}
                stroke="#d9c25c"
                strokeWidth="1"
                strokeOpacity={edge.opacity}
              />
            ))}
            {layer.nodes.map((node, index) => (
              <g
                key={`${layer.key}-node-${index}`}
                className="constellation-node"
                style={{ animationDelay: `${(index % 7) * 0.6}s` }}
              >
                <circle cx={node.x} cy={node.y} r={node.r * 4} fill="url(#nodeGlow)" opacity="0.3" />
                <circle cx={node.x} cy={node.y} r={node.r} fill="#d9c25c" />
              </g>
            ))}
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
