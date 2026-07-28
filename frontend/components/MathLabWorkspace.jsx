import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Calculator, Sigma } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'
import ChatMarkdown from './ChatMarkdown'

// GeoGebra manipulates the DOM directly and needs a real browser, so it's
// loaded client-only, same pattern as the 3D Studio's Three.js scene.
const GeoGebraGraph = dynamic(() => import('./GeoGebraGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center text-sm text-zinc-600">
      Loading GeoGebra...
    </div>
  )
})

const APP_MODES = [
  { value: 'graphing', label: '2D Graphing' },
  { value: '3d', label: '3D Graphing' },
  { value: 'geometry', label: 'Geometry' },
  { value: 'classic', label: 'Classic (full toolset)' }
]

const OPERATIONS = [
  { value: 'solve', label: 'Solve for x' },
  { value: 'simplify', label: 'Simplify' },
  { value: 'derivative', label: 'Derivative' },
  { value: 'integral', label: 'Integral' },
  { value: 'evaluate', label: 'Evaluate' }
]

export default function MathLabWorkspace({ onResult } = {}) {
  const { token } = useAuth()
  const [appMode, setAppMode] = useState('graphing')

  const [operation, setOperation] = useState('solve')
  const [expression, setExpression] = useState('x**2 - 4')
  const [variable, setVariable] = useState('x')
  const [computing, setComputing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const handleCompute = async (event) => {
    event.preventDefault()
    setError('')
    setResult(null)
    if (!expression.trim()) {
      setError('Enter an expression first.')
      return
    }

    setComputing(true)
    try {
      const payload = await requestBackendJson('/math-lab/compute', {
        method: 'POST',
        headers: authHeaders,
        body: { operation, expression: expression.trim(), variable: variable.trim() || 'x' }
      })
      setResult(payload)
      onResult?.(payload)
    } catch (err) {
      setError(err.message || 'Could not compute that expression.')
    } finally {
      setComputing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <p className="section-kicker text-[#18181b]">GeoGebra</p>
              <h2 className="text-lg font-bold text-zinc-950">Interactive graphing &amp; geometry</h2>
            </div>
          </div>

          <select value={appMode} onChange={(event) => setAppMode(event.target.value)} className="input">
            {APP_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <GeoGebraGraph key={appMode} appName={appMode} height={520} />
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <Sigma className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Symbolic calculator</p>
            <h2 className="text-lg font-bold text-zinc-950">Solve, simplify, differentiate, or integrate</h2>
          </div>
        </div>

        <form onSubmit={handleCompute} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <select value={operation} onChange={(event) => setOperation(event.target.value)} className="input">
              {OPERATIONS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="e.g. x**2 - 4, sin(x)*x, sqrt(x+1)"
              className="input"
            />
            <input
              value={variable}
              onChange={(event) => setVariable(event.target.value)}
              placeholder="x"
              className="input w-20"
              title="Variable to solve/differentiate/integrate with respect to"
            />
          </div>

          <p className="text-xs text-zinc-500">
            Use <code>**</code> for powers, and standard names like <code>sin</code>, <code>cos</code>, <code>sqrt</code>, <code>pi</code>, <code>exp</code>, <code>log</code>.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={computing} className="btn btn-primary">
            {computing ? 'Computing...' : 'Compute'}
          </button>
        </form>

        {result && (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Result</p>
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
          </div>
        )}
      </div>
    </div>
  )
}
