import React from 'react'
import AppShell from '../components/AppShell'
import MathLabWorkspace from '../components/MathLabWorkspace'

export default function MathLabPage() {
  return (
    <AppShell
      eyebrow="Math Lab"
      title="Graph it, solve it, see it"
      description="An interactive GeoGebra graphing/geometry canvas alongside a symbolic calculator for solving, simplifying, differentiating, and integrating."
    >
      <MathLabWorkspace />
    </AppShell>
  )
}
