import React, { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FlaskConical, Plus, Trash2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

const LINE_COLORS = ['#d9c25c', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#ea580c', '#4d7c0f']

function emptyParticipant() {
  return { species: '', stoichiometry: 1 }
}

export default function BioLabWorkspace() {
  const { token } = useAuth()
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const [species, setSpecies] = useState([{ name: 'A', initial_concentration: 10 }, { name: 'B', initial_concentration: 0 }])
  const [newSpeciesName, setNewSpeciesName] = useState('')
  const [newSpeciesConc, setNewSpeciesConc] = useState(0)

  const [reactants, setReactants] = useState([{ species: 'A', stoichiometry: 1 }])
  const [products, setProducts] = useState([{ species: 'B', stoichiometry: 1 }])
  const [rateConstant, setRateConstant] = useState(0.3)
  const [reactions, setReactions] = useState([])

  const [duration, setDuration] = useState(10)
  const [points, setPoints] = useState(100)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const addSpecies = () => {
    const name = newSpeciesName.trim()
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
      setError('Species names must start with a letter and use only letters, numbers, or underscores.')
      return
    }
    if (species.some((s) => s.name === name)) {
      setError('That species name is already used.')
      return
    }
    setError('')
    setSpecies((current) => [...current, { name, initial_concentration: Number(newSpeciesConc) || 0 }])
    setNewSpeciesName('')
    setNewSpeciesConc(0)
  }

  const removeSpecies = (name) => {
    setSpecies((current) => current.filter((s) => s.name !== name))
    setReactions((current) => current.filter((r) =>
      !r.reactants.some((p) => p.species === name) && !r.products.some((p) => p.species === name)
    ))
  }

  const updateParticipantList = (setList, index, field, value) => {
    setList((current) => current.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const addParticipantRow = (setList, current) => {
    if (current.length >= 5) return
    setList((prev) => [...prev, emptyParticipant()])
  }

  const removeParticipantRow = (setList, index) => {
    setList((current) => current.filter((_, i) => i !== index))
  }

  const addReaction = () => {
    const validReactants = reactants.filter((p) => p.species)
    const validProducts = products.filter((p) => p.species)
    if (validReactants.length === 0) {
      setError('A reaction needs at least one reactant.')
      return
    }
    if (!rateConstant || Number(rateConstant) <= 0) {
      setError('Rate constant must be a positive number.')
      return
    }
    setError('')
    setReactions((current) => [...current, {
      reactants: validReactants.map((p) => ({ species: p.species, stoichiometry: Number(p.stoichiometry) || 1 })),
      products: validProducts.map((p) => ({ species: p.species, stoichiometry: Number(p.stoichiometry) || 1 })),
      rate_constant: Number(rateConstant)
    }])
    setReactants([emptyParticipant()])
    setProducts([emptyParticipant()])
    setRateConstant(0.3)
  }

  const removeReaction = (index) => {
    setReactions((current) => current.filter((_, i) => i !== index))
  }

  const describeReaction = (reaction) => {
    const side = (list) => list.map((p) => (p.stoichiometry > 1 ? `${p.stoichiometry}${p.species}` : p.species)).join(' + ')
    return `${side(reaction.reactants)} → ${side(reaction.products) || '∅'}  (k = ${reaction.rate_constant})`
  }

  const runSimulation = async () => {
    if (species.length === 0) {
      setError('Add at least one species first.')
      return
    }
    if (reactions.length === 0) {
      setError('Add at least one reaction first.')
      return
    }
    setRunning(true)
    setError('')
    try {
      const payload = await requestBackendJson('/bio-lab/simulate', {
        method: 'POST',
        headers: authHeaders,
        body: { species, reactions, duration: Number(duration), points: Number(points) }
      })
      setResult(payload)
    } catch (err) {
      setError(err.message || 'Could not simulate that reaction network.')
    } finally {
      setRunning(false)
    }
  }

  const chartData = result
    ? result.time_points.map((t, i) => {
        const row = { t: Number(t.toFixed(2)) }
        result.species_names.forEach((name) => {
          row[name] = result.concentrations[name][i]
        })
        return row
      })
    : []

  const participantEditor = (label, list, setList) => (
    <div>
      <p className="text-xs font-semibold text-zinc-600">{label}</p>
      <div className="mt-2 space-y-2">
        {list.map((p, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={p.stoichiometry}
              onChange={(event) => updateParticipantList(setList, index, 'stoichiometry', event.target.value)}
              className="input w-16"
            />
            <select
              value={p.species}
              onChange={(event) => updateParticipantList(setList, index, 'species', event.target.value)}
              className="input flex-1"
            >
              <option value="">Select species...</option>
              {species.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            {list.length > 1 && (
              <button type="button" onClick={() => removeParticipantRow(setList, index)} className="text-zinc-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addParticipantRow(setList, list)}
          disabled={list.length >= 5}
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
        >
          + add {label.toLowerCase()}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Species</p>
            <h2 className="text-lg font-bold text-zinc-950">Define what&apos;s in the system</h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {species.map((s) => (
            <div key={s.name} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
              {s.name} = {s.initial_concentration}
              <button type="button" onClick={() => removeSpecies(s.name)} className="text-zinc-400 hover:text-red-600">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={newSpeciesName}
            onChange={(event) => setNewSpeciesName(event.target.value)}
            placeholder="Name (e.g. A)"
            className="input w-32"
          />
          <input
            type="number"
            value={newSpeciesConc}
            onChange={(event) => setNewSpeciesConc(event.target.value)}
            placeholder="Initial concentration"
            className="input w-44"
          />
          <button type="button" onClick={addSpecies} className="btn btn-outline inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add species
          </button>
        </div>
      </div>

      <div className="card p-6">
        <p className="section-kicker text-[#18181b]">Reactions</p>
        <h2 className="mb-4 text-lg font-bold text-zinc-950">Mass-action kinetics: reactants → products at rate k</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {participantEditor('Reactants', reactants, setReactants)}
          {participantEditor('Products', products, setProducts)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-zinc-600">Rate constant k</label>
          <input
            type="number"
            step="0.01"
            value={rateConstant}
            onChange={(event) => setRateConstant(event.target.value)}
            className="input w-32"
          />
          <button type="button" onClick={addReaction} className="btn btn-outline inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add reaction
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {reactions.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reaction network</p>
            {reactions.map((reaction, index) => (
              <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <span>{describeReaction(reaction)}</span>
                <button type="button" onClick={() => removeReaction(index)} className="text-red-600 hover:text-red-800">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-zinc-600">Duration</label>
          <input type="number" value={duration} onChange={(event) => setDuration(event.target.value)} className="input w-24" />
          <label className="text-xs font-semibold text-zinc-600">Points</label>
          <input type="number" value={points} onChange={(event) => setPoints(event.target.value)} className="input w-24" />
          <button type="button" onClick={runSimulation} disabled={running} className="btn btn-primary">
            {running ? 'Simulating...' : 'Run simulation'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-bold text-zinc-950">Concentration over time</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="t" tick={{ fontSize: 12 }} label={{ value: 'time', position: 'insideBottom', offset: -3, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {result.species_names.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
