import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls, Text } from '@react-three/drei'

// Bloch sphere convention: z is the computational-basis axis (|0> at the
// north pole, |1> at the south pole), x/y capture phase information. Three.js
// treats y as "up", so we map bloch (x, y, z) -> three (x, z, y): the
// computational axis becomes the vertical one on screen, matching every
// textbook diagram of a Bloch sphere.
function toThreeCoords([x, y, z]) {
  return [x, z, y]
}

function Arrow({ vector, color }) {
  const length = Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2)
  const end = toThreeCoords(vector)
  if (length < 0.02) {
    // Maximally mixed (entangled-away) state -- no arrow, just a dot at center.
    return (
      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#71717a" />
      </mesh>
    )
  }
  return (
    <>
      <Line points={[[0, 0, 0], end]} color={color} lineWidth={3} />
      <mesh position={end}>
        <coneGeometry args={[0.06, 0.18, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  )
}

function AxisLines() {
  const axisColor = '#a1a1aa'
  return (
    <>
      <Line points={[[-1.15, 0, 0], [1.15, 0, 0]]} color={axisColor} lineWidth={1} />
      <Line points={[[0, -1.15, 0], [0, 1.15, 0]]} color={axisColor} lineWidth={1} />
      <Line points={[[0, 0, -1.15], [0, 0, 1.15]]} color={axisColor} lineWidth={1} />
      <Text position={[0, 1.3, 0]} fontSize={0.18} color="#18181b" anchorX="center" anchorY="middle">|0⟩</Text>
      <Text position={[0, -1.3, 0]} fontSize={0.18} color="#18181b" anchorX="center" anchorY="middle">|1⟩</Text>
    </>
  )
}

/**
 * Renders one qubit's reduced state as a Bloch sphere -- a vector of length
 * 1 is a pure state, shorter means this qubit is entangled with (or mixed
 * with) another qubit in the circuit, which is itself a useful thing for a
 * student to see happen live as they add a CNOT gate.
 */
export default function BlochSphere({ vector = [0, 0, 1], label, color = '#d9c25c' }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-[220px] w-full overflow-hidden rounded-2xl border border-black/10 bg-white">
        <Canvas camera={{ position: [2.2, 1.6, 2.2], fov: 45 }}>
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 4, 2]} intensity={0.6} />
          <mesh>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color="#f2e9c4" transparent opacity={0.22} wireframe={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#0a0a0a" wireframe transparent opacity={0.15} />
          </mesh>
          <AxisLines />
          <Arrow vector={vector} color={color} />
          <OrbitControls enablePan={false} minDistance={2.5} maxDistance={6} />
        </Canvas>
      </div>
      <p className="mt-2 text-xs font-semibold text-zinc-700">{label}</p>
    </div>
  )
}
