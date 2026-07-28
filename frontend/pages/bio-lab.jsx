import React from 'react'
import AppShell from '../components/AppShell'
import BioLabWorkspace from '../components/BioLabWorkspace'
import HowToUseCard from '../components/HowToUseCard'

const STEPS = [
  'Add species with a starting concentration, e.g. A = 10 and B = 0 (already filled in by default).',
  'Build a reaction: pick reactants and products from your species list, set a rate constant k, then click "Add reaction."',
  'Click "Run simulation" to see concentration-over-time curves for every species.',
  'Try a simple decay first: A → B with rate 0.3 -- A curves down, B curves up, smoothly.',
  'Add a second, reverse reaction (B → A with a smaller rate) to see the system settle into equilibrium instead of running to completion.'
]

export default function BioLabPage() {
  return (
    <AppShell
      eyebrow="Bio Lab"
      title="Define a reaction network, watch it evolve"
      description="A mass-action kinetics simulator -- define species and reactions, and see concentration-over-time curves solved numerically, the same modeling approach behind Virtual Cell's ODE mode."
    >
      <div className="space-y-6">
        <HowToUseCard steps={STEPS} />
        <BioLabWorkspace />
      </div>
    </AppShell>
  )
}
