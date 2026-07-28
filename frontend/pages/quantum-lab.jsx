import React from 'react'
import AppShell from '../components/AppShell'
import HowToUseCard from '../components/HowToUseCard'
import QuantumLabWorkspace from '../components/QuantumLabWorkspace'

const STEPS = [
  'Pick how many qubits (1-4) from the dropdown.',
  'Add gates one at a time: choose a gate, choose which qubit(s) it acts on, and click Add. Two-qubit gates like CNOT need a control and a target qubit.',
  'Click "Run simulation" to see measurement probabilities as a bar chart and each qubit’s state as a 3D Bloch sphere.',
  'Try a Bell state: add H on q0, then CNOT with control q0 / target q1. You should see 50/50 probability on |00⟩ and |11⟩, and both Bloch spheres shrink to the center -- that’s entanglement, neither qubit has an independent state anymore.',
  'Every circuit runs through two independent simulators (Qiskit and Cirq) and is cross-checked -- the "agree/disagree" badge next to the chart confirms the result is trustworthy.'
]

export default function QuantumLabPage() {
  return (
    <AppShell
      eyebrow="Quantum Lab"
      title="Build a circuit, see the qubit"
      description="A small quantum circuit builder -- every circuit runs through both Qiskit and Cirq independently and is cross-checked, with a live 3D Bloch sphere per qubit and a measurement-probability chart."
    >
      <div className="space-y-6">
        <HowToUseCard steps={STEPS} />
        <QuantumLabWorkspace />
      </div>
    </AppShell>
  )
}
