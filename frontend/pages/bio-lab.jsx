import React from 'react'
import AppShell from '../components/AppShell'
import BioLabWorkspace from '../components/BioLabWorkspace'

export default function BioLabPage() {
  return (
    <AppShell
      eyebrow="Bio Lab"
      title="Define a reaction network, watch it evolve"
      description="A mass-action kinetics simulator -- define species and reactions, and see concentration-over-time curves solved numerically, the same modeling approach behind Virtual Cell's ODE mode."
    >
      <BioLabWorkspace />
    </AppShell>
  )
}
