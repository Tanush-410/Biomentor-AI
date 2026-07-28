import React from 'react'
import AppShell from '../components/AppShell'
import HowToUseCard from '../components/HowToUseCard'
import MathLabWorkspace from '../components/MathLabWorkspace'

const STEPS = [
  'Type directly into the GeoGebra input box on the left to graph something -- e.g. y = x^2, or switch the dropdown to "3D Graphing" and try z = x^2 + y^2.',
  'Use built-in commands for exact shapes: Sphere((0,0,0), 3) draws a sphere of radius 3, Line((0,0),(1,1)) draws a line through two points.',
  'Switch the dropdown to "Geometry" for constructions like triangles and circles, or "Classic" for the full toolset with an algebra view.',
  'In the Symbolic Calculator below, pick an operation (solve, simplify, derivative, integral, evaluate), type an expression like x**2 + 3*x, and click Compute.',
  'Use ** for powers and standard names like sin, cos, sqrt, pi, exp, log in the calculator -- it is separate from GeoGebra and does not understand GeoGebra commands.'
]

export default function MathLabPage() {
  return (
    <AppShell
      eyebrow="Math Lab"
      title="Graph it, solve it, see it"
      description="An interactive GeoGebra graphing/geometry canvas alongside a symbolic calculator for solving, simplifying, differentiating, and integrating."
    >
      <div className="space-y-6">
        <HowToUseCard steps={STEPS} />
        <MathLabWorkspace />
      </div>
    </AppShell>
  )
}
