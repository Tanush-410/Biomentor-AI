import React, { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, MonitorPlay, X, XCircle } from 'lucide-react'

import BioLabWorkspace from './BioLabWorkspace'
import ChatMarkdown from './ChatMarkdown'
import MathLabWorkspace from './MathLabWorkspace'
import QuantumLabWorkspace from './QuantumLabWorkspace'
import SharedShapeStudio from './SharedShapeStudio'
import { applySceneEvent, createEmptyScene, sceneBondsArray, sceneShapesArray } from '../lib/sceneEvents'

const ShapeStudioScene = dynamic(() => import('./ShapeStudioScene'), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-[300px] items-center justify-center text-xs text-zinc-500">Loading 3D viewport...</div>
})

const TOOL_LABELS = {
  'math-lab': 'Math Lab',
  'quantum-lab': 'Quantum Lab',
  'bio-lab': 'Bio Lab',
  '3d-studio': '3D Studio'
}

const BLOCH_COLORS = ['#d9c25c', '#2563eb', '#16a34a', '#dc2626']

function EmptyViewer({ text }) {
  return <p className="p-6 text-center text-sm text-zinc-500">{text}</p>
}

// ---- Math Lab -------------------------------------------------------

function MathLabPresenter({ onState }) {
  return <MathLabWorkspace onResult={(result) => onState({ kind: 'compute', result })} />
}

function MathLabViewer({ state }) {
  if (!state?.result) {
    return <EmptyViewer text="Waiting for the presenter to compute something in Math Lab..." />
  }
  const { result } = state
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {result.operation} of {result.input_expression}
      </p>
      {result.result_latex ? (
        <div className="mt-2 text-lg">
          <ChatMarkdown content={`$$${result.result_latex}$$`} />
        </div>
      ) : (
        <p className="mt-2 text-lg font-semibold text-zinc-900">{result.result}</p>
      )}
      {result.numeric_approx && (
        <p className="mt-2 text-sm text-zinc-600">Numeric approximation: {result.numeric_approx}</p>
      )}
      <p className="mt-4 text-xs leading-5 text-zinc-500">
        The interactive GeoGebra graph itself is only visible on the presenter&apos;s screen for now -- this mirrors their calculator results live.
      </p>
    </div>
  )
}

// ---- Quantum Lab ------------------------------------------------------

function QuantumLabPresenter({ onState }) {
  return <QuantumLabWorkspace onResult={(result) => onState({ kind: 'run', result })} />
}

function QuantumLabViewer({ state }) {
  if (!state?.result) {
    return <EmptyViewer text="Waiting for the presenter to run a circuit in Quantum Lab..." />
  }
  const { result } = state
  const chartData = result.basis_states.map((s, i) => ({ state: `|${s}⟩`, probability: result.probabilities[i] }))
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{result.gates?.length || 0}-gate circuit, {result.numQubits} qubit(s)</p>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${result.engines_agree ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {result.engines_agree ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            Qiskit &amp; Cirq {result.engines_agree ? 'agree' : 'disagree'}
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="state" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => value.toFixed(4)} />
              <Bar dataKey="probability" fill="#d9c25c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {result.bloch_vectors?.map((bloch, i) => (
          <div key={bloch.qubit} className="rounded-xl border border-zinc-200 bg-white p-2 text-center text-xs text-zinc-600">
            <div className="mx-auto h-2 w-2 rounded-full" style={{ backgroundColor: BLOCH_COLORS[i % BLOCH_COLORS.length] }} />
            <p className="mt-1">Qubit {bloch.qubit} — purity {bloch.purity.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Bio Lab ------------------------------------------------------

const LINE_COLORS = ['#d9c25c', '#2563eb', '#16a34a', '#dc2626', '#7c3aed']

function BioLabPresenter({ onState }) {
  return <BioLabWorkspace onResult={(result) => onState({ kind: 'run', result })} />
}

function BioLabViewer({ state }) {
  if (!state?.result) {
    return <EmptyViewer text="Waiting for the presenter to run a simulation in Bio Lab..." />
  }
  const { result } = state
  const chartData = result.time_points.map((t, i) => {
    const row = { t: Number(t.toFixed(2)) }
    result.species_names.forEach((name) => { row[name] = result.concentrations[name][i] })
    return row
  })
  return (
    <div className="card p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Concentration over time</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="t" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {result.species_names.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---- 3D Studio ------------------------------------------------------
// Reuses the exact same event-sourcing reducer already built and tested for
// the Collaboration hub's Shared 3D Studio, but broadcasts the whole scene
// as one snapshot per change (matching this meeting channel's "latest
// state wins" design) instead of an incremental event log.

let studioIdCounter = 0
function nextStudioId(prefix) {
  studioIdCounter += 1
  return `${prefix}-${Date.now()}-${studioIdCounter}`
}

function createStudioShape(type) {
  const offset = (studioIdCounter % 5) * 0.4 - 0.8
  return { id: nextStudioId('shape'), type, color: '#d9c25c', label: '', position: [offset, 0.65, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
}

function ThreeDStudioPresenter({ onState }) {
  const [scene, setScene] = useState(createEmptyScene())
  const transformDebounceRef = useRef({})

  const broadcast = (nextScene) => onState({ kind: 'scene', shapesById: nextScene.shapesById, bondsById: nextScene.bondsById })

  const apply = (event) => {
    setScene((current) => {
      const next = applySceneEvent(current, event)
      broadcast(next)
      return next
    })
  }

  const onAddShape = (type) => apply({ event_type: 'shape_create', metadata: { shape: createStudioShape(type) } })
  const onDeleteShape = (id) => apply({ event_type: 'shape_delete', metadata: { shapeId: id } })
  const onSetColor = (id, color) => apply({ event_type: 'shape_update', metadata: { shapeId: id, patch: { color } } })
  const onSetLabel = (id, label) => apply({ event_type: 'shape_update', metadata: { shapeId: id, patch: { label } } })
  const onAddBond = (points) => apply({ event_type: 'shape_connect', metadata: { bond: { id: nextStudioId('bond'), points } } })
  const onRemoveBond = (bondId) => apply({ event_type: 'shape_disconnect', metadata: { bondId } })
  const onClear = () => apply({ event_type: 'shape_clear', metadata: {} })

  const onTransform = (id, patch) => {
    setScene((current) => applySceneEvent(current, { event_type: 'shape_update', metadata: { shapeId: id, patch } }))
    clearTimeout(transformDebounceRef.current[id])
    transformDebounceRef.current[id] = setTimeout(() => {
      setScene((current) => {
        broadcast(current)
        return current
      })
    }, 150)
  }

  return (
    <SharedShapeStudio
      shapes={sceneShapesArray(scene)}
      bonds={sceneBondsArray(scene)}
      onAddShape={onAddShape}
      onTransform={onTransform}
      onDeleteShape={onDeleteShape}
      onSetColor={onSetColor}
      onSetLabel={onSetLabel}
      onAddBond={onAddBond}
      onRemoveBond={onRemoveBond}
      onClear={onClear}
    />
  )
}

function ThreeDStudioViewer({ state }) {
  if (!state?.shapesById || Object.keys(state.shapesById).length === 0) {
    return <EmptyViewer text="Waiting for the presenter to add something in 3D Studio..." />
  }
  const shapes = Object.values(state.shapesById)
  const bonds = Object.values(state.bondsById || {}).map((bond) => bond.points)
  return (
    <div className="h-[420px] overflow-hidden rounded-2xl border border-black/10">
      <ShapeStudioScene
        shapes={shapes}
        selectedId={null}
        mode="translate"
        onSelect={() => {}}
        onDeselect={() => {}}
        onTransform={() => {}}
        lineDraft={[]}
        finishedLines={bonds}
        onAddLinePoint={() => {}}
      />
    </div>
  )
}

// ---- Dispatcher ------------------------------------------------------

const PRESENTERS = {
  'math-lab': MathLabPresenter,
  'quantum-lab': QuantumLabPresenter,
  'bio-lab': BioLabPresenter,
  '3d-studio': ThreeDStudioPresenter
}

const VIEWERS = {
  'math-lab': MathLabViewer,
  'quantum-lab': QuantumLabViewer,
  'bio-lab': BioLabViewer,
  '3d-studio': ThreeDStudioViewer
}

export default function SharedToolPanel({ sharedTool, isPresenting, onState, onClose }) {
  if (!sharedTool) return null

  const label = TOOL_LABELS[sharedTool.tool] || sharedTool.tool
  const Presenter = PRESENTERS[sharedTool.tool]
  const Viewer = VIEWERS[sharedTool.tool]

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <MonitorPlay className="h-4 w-4 text-[#a88a26]" />
          {label} {isPresenting ? '— you are presenting' : `— presented by ${sharedTool.presenterName || 'the educator'}`}
        </div>
        {isPresenting && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-black"
          >
            <X className="h-3.5 w-3.5" />
            Stop sharing
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isPresenting && Presenter ? (
          <Presenter onState={onState} />
        ) : Viewer ? (
          <Viewer state={sharedTool.state} />
        ) : (
          <EmptyViewer text="Unknown tool." />
        )}
      </div>
    </div>
  )
}
