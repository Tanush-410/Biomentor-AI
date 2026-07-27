import React from 'react'
import AppShell from '../components/AppShell'
import QuantumLabWorkspace from '../components/QuantumLabWorkspace'

export default function QuantumLabPage() {
  return (
    <AppShell
      eyebrow="Quantum Lab"
      title="Build a circuit, see the qubit"
      description="A small quantum circuit builder -- every circuit runs through both Qiskit and Cirq independently and is cross-checked, with a live 3D Bloch sphere per qubit and a measurement-probability chart."
    >
      <QuantumLabWorkspace />
    </AppShell>
  )
}
