import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Atom, CheckCircle2, Plus, Trash2, XCircle, Zap } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

// Bloch sphere rendering needs a real browser canvas.
const BlochSphere = dynamic(() => import('./BlochSphere'), {
  ssr: false,
  loading: () => <div className="flex h-[220px] items-center justify-center text-xs text-zinc-500">Loading...</div>
})

const SINGLE_QUBIT_GATES = [
  { value: 'h', label: 'H (Hadamard)' },
  { value: 'x', label: 'X (bit flip)' },
  { value: 'y', label: 'Y' },
  { value: 'z', label: 'Z (phase flip)' },
  { value: 's', label: 'S' },
  { value: 't', label: 'T' },
  { value: 'sdg', label: 'S†' },
  { value: 'tdg', label: 'T†' }
]
const ROTATION_GATES = [
  { value: 'rx', label: 'RX(θ)' },
  { value: 'ry', label: 'RY(θ)' },
  { value: 'rz', label: 'RZ(θ)' }
]
const TWO_QUBIT_GATES = [
  { value: 'cx', label: 'CNOT (control → target)' },
  { value: 'cz', label: 'CZ' },
  { value: 'swap', label: 'SWAP' }
]
const ALL_GATES = [...SINGLE_QUBIT_GATES, ...ROTATION_GATES, ...TWO_QUBIT_GATES]
const GATE_LABELS = Object.fromEntries(ALL_GATES.map((g) => [g.value, g.label]))

const BLOCH_COLORS = ['#d9c25c', '#2563eb', '#16a34a', '#dc2626']

export default function QuantumLabWorkspace({ onResult } = {}) {
  const { token } = useAuth()
  const [numQubits, setNumQubits] = useState(2)
  const [gates, setGates] = useState([])

  const [gateType, setGateType] = useState('h')
  const [qubitA, setQubitA] = useState(0)
  const [qubitB, setQubitB] = useState(1)
  const [angle, setAngle] = useState(1.5708)

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
  const isTwoQubit = TWO_QUBIT_GATES.some((g) => g.value === gateType)
  const isRotation = ROTATION_GATES.some((g) => g.value === gateType)

  const changeQubitCount = (count) => {
    setNumQubits(count)
    setGates((current) => current.filter((g) => g.qubits.every((q) => q < count)))
    setResult(null)
  }

  const addGate = () => {
    const qubits = isTwoQubit ? [Number(qubitA), Number(qubitB)] : [Number(qubitA)]
    if (isTwoQubit && qubitA === qubitB) {
      setError('Pick two different qubits for a two-qubit gate.')
      return
    }
    setError('')
    setGates((current) => [...current, { gate: gateType, qubits, angle: isRotation ? Number(angle) : undefined }])
  }

  const removeGate = (index) => {
    setGates((current) => current.filter((_, i) => i !== index))
  }

  const clearGates = () => {
    setGates([])
    setResult(null)
  }

  const runSimulation = async () => {
    setRunning(true)
    setError('')
    try {
      const payload = await requestBackendJson('/quantum-lab/simulate', {
        method: 'POST',
        headers: authHeaders,
        body: { num_qubits: numQubits, gates }
      })
      setResult(payload)
      onResult?.({ numQubits, gates, ...payload })
    } catch (err) {
      setError(err.message || 'Could not simulate that circuit.')
    } finally {
      setRunning(false)
    }
  }

  const chartData = result
    ? result.basis_states.map((state, i) => ({
        state: `|${state}⟩`,
        probability: result.probabilities[i]
      }))
    : []

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <Atom className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Circuit builder</p>
            <h2 className="text-lg font-bold text-zinc-950">Build a small quantum circuit</h2>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-zinc-600">Qubits</label>
          <select value={numQubits} onChange={(event) => changeQubitCount(Number(event.target.value))} className="input w-20">
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]">
          <select value={gateType} onChange={(event) => setGateType(event.target.value)} className="input">
            <optgroup label="Single-qubit">
              {SINGLE_QUBIT_GATES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </optgroup>
            <optgroup label="Rotation">
              {ROTATION_GATES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </optgroup>
            <optgroup label="Two-qubit">
              {TWO_QUBIT_GATES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </optgroup>
          </select>

          <select value={qubitA} onChange={(event) => setQubitA(Number(event.target.value))} className="input">
            {Array.from({ length: numQubits }, (_, i) => (
              <option key={i} value={i}>{isTwoQubit ? `control q${i}` : `q${i}`}</option>
            ))}
          </select>

          {isTwoQubit ? (
            <select value={qubitB} onChange={(event) => setQubitB(Number(event.target.value))} className="input">
              {Array.from({ length: numQubits }, (_, i) => (
                <option key={i} value={i}>{`target q${i}`}</option>
              ))}
            </select>
          ) : <div />}

          {isRotation ? (
            <input
              type="number"
              step="0.01"
              value={angle}
              onChange={(event) => setAngle(event.target.value)}
              className="input"
              title="Angle in radians"
            />
          ) : <div />}

          <button type="button" onClick={addGate} className="btn btn-outline inline-flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Circuit ({gates.length} gate{gates.length === 1 ? '' : 's'})</p>
          {gates.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No gates yet -- add one above.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {gates.map((g, index) => (
                <div key={index} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
                  {GATE_LABELS[g.gate]} on q{g.qubits.join(',')}
                  {g.angle !== undefined && ` (${Number(g.angle).toFixed(2)} rad)`}
                  <button type="button" onClick={() => removeGate(index)} className="text-zinc-400 hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={runSimulation} disabled={running} className="btn btn-primary inline-flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {running ? 'Simulating...' : 'Run simulation'}
          </button>
          <button type="button" onClick={clearGates} disabled={gates.length === 0} className="btn btn-outline">
            Clear circuit
          </button>
        </div>
      </div>

      {result && (
        <>
          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-950">Measurement probabilities</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${result.engines_agree ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {result.engines_agree ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                Qiskit &amp; Cirq {result.engines_agree ? 'agree' : 'disagree'}
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="state" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => value.toFixed(4)} />
                  <Bar dataKey="probability" fill="#d9c25c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-lg font-bold text-zinc-950">Per-qubit Bloch sphere</h3>
            <p className="mb-4 text-xs leading-5 text-zinc-500">
              A short or zero-length vector means this qubit is entangled with another qubit in the circuit -- its own state can&apos;t be described alone anymore.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {result.bloch_vectors.map((bloch, i) => (
                <BlochSphere
                  key={bloch.qubit}
                  vector={[bloch.x, bloch.y, bloch.z]}
                  label={`Qubit ${bloch.qubit} — purity ${bloch.purity.toFixed(2)}`}
                  color={BLOCH_COLORS[i % BLOCH_COLORS.length]}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
