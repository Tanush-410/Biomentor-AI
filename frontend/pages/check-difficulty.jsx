import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { GitBranchPlus, Lightbulb, Sparkles } from 'lucide-react'
import { useRouter } from 'next/router'

import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

const BLOOM_LEVELS = [
  { level: 1, name: 'Remember', tone: 'border-zinc-200 bg-zinc-50 text-zinc-700' },
  { level: 2, name: 'Understand', tone: 'border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]' },
  { level: 3, name: 'Apply', tone: 'border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]' },
  { level: 4, name: 'Analyze', tone: 'border-[#d4d4d8] bg-[#f4f4f5] text-[#27272a]' },
  { level: 5, name: 'Evaluate', tone: 'border-[#d4d4d8] bg-[#f4f4f5] text-[#3f3f46]' },
  { level: 6, name: 'Create', tone: 'border-[#52525b] bg-[#f4f4f5] text-[#18181b]' }
]

export default function CheckDifficultyPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [question, setQuestion] = useState('')
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [targetLevel, setTargetLevel] = useState(null)
  const [converting, setConverting] = useState(false)
  const [convertedQuestion, setConvertedQuestion] = useState(null)
  const [allVariants, setAllVariants] = useState([])
  const [generatingAll, setGeneratingAll] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    if (user?.role === 'student') {
      router.push('/dashboard')
    }
  }, [authLoading, token, user, router])

  const identifiedLevelMeta = useMemo(
    () => BLOOM_LEVELS.find((item) => item.level === analyzeResult?.level) || null,
    [analyzeResult]
  )

  const convertedVariant = convertedQuestion?.variants?.[0] || null

  const handleIdentifyLevel = async () => {
    if (!question.trim()) {
      setError('Please enter a question first')
      return
    }

    setError('')
    setAnalyzing(true)
    try {
      const data = await requestBackendJson('/quiz/analyze-level', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { question_text: question }
      })
      setAnalyzeResult(data)
    } catch (err) {
      console.error('Error analyzing level:', err)
      setError(err.message || 'Failed to analyze question')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleGenerateAllLevels = async () => {
    if (!question.trim()) {
      setError('Please enter a question first')
      return
    }

    setError('')
    setGeneratingAll(true)
    try {
      const data = await requestBackendJson('/quiz/generate-level-variants', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { question_text: question }
      })

      setAnalyzeResult({
        level: data.identified_level,
        level_name: data.identified_level_name,
        confidence: data.confidence,
        description: `The original question is best aligned to Bloom's level ${data.identified_level_name}.`
      })
      setAllVariants(data.variants || [])
      setTargetLevel(null)
      setConvertedQuestion(null)
    } catch (err) {
      console.error('Error generating all levels:', err)
      setError(err.message || 'Failed to generate all Bloom variants')
    } finally {
      setGeneratingAll(false)
    }
  }

  const handleConvertQuestion = async () => {
    if (!targetLevel) {
      setError('Please select a target level')
      return
    }

    setError('')
    setConverting(true)
    try {
      const data = await requestBackendJson('/quiz/convert-difficulty', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          question_text: question,
          current_level: analyzeResult.level,
          target_level: targetLevel
        }
      })
      setConvertedQuestion(data)
    } catch (err) {
      console.error('Error converting question:', err)
      setError(err.message || 'Failed to convert question')
    } finally {
      setConverting(false)
    }
  }

  const handleClear = () => {
    setQuestion('')
    setAnalyzeResult(null)
    setError('')
    setConvertedQuestion(null)
    setTargetLevel(null)
    setAllVariants([])
  }

  return (
    <AppShell
      title="Bloom Studio"
      eyebrow="Educator Workflow"
      description="Identify a question's Bloom level, compare variants across all six levels, and generate one exact rewrite when you need a more precise teaching prompt."
      contentClassName="max-w-6xl space-y-8"
      actions={
        <>
          <Link href="/dashboard" className="btn btn-outline">Dashboard</Link>
          <Link href="/educator/class-insights" className="btn btn-outline">Class Insights</Link>
          <Link href="/collaboration-hub" className="btn btn-primary">Live Session</Link>
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="card p-6">
          <p className="section-kicker text-[#18181b]">Question input</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Paste one question and decide how far you want to take it.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Start with identification, branch into all Bloom variants, or generate one exact target-level rewrite for a focused classroom need.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Question prompt</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Paste any classroom question or assessment prompt here..."
                className="input min-h-[220px] resize-none"
                rows={8}
              />
            </div>

            {error && (
              <div className="rounded-[18px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-900">
                {error}
              </div>
            )}

            <div className="grid gap-3">
              <button
                onClick={handleIdentifyLevel}
                disabled={!question || analyzing}
                className="btn btn-outline w-full justify-center"
              >
                <Lightbulb className="h-4 w-4" />
                {analyzing ? 'Identifying level...' : 'Identify Current Level'}
              </button>
              <button
                onClick={handleGenerateAllLevels}
                disabled={!question || generatingAll}
                className="btn btn-primary w-full justify-center"
              >
                <GitBranchPlus className="h-4 w-4" />
                {generatingAll ? 'Generating all variants...' : 'Generate All Bloom Levels'}
              </button>
              <button onClick={handleClear} className="btn btn-outline w-full justify-center">
                Clear Studio
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-slate-500">Detected level</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Question readout</h2>
              </div>
              {identifiedLevelMeta && (
                <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${identifiedLevelMeta.tone}`}>
                  Level {identifiedLevelMeta.level}
                </div>
              )}
            </div>

            {!analyzeResult ? (
              <div className="surface-subtle mt-5 p-5">
                <p className="text-sm font-semibold text-slate-900">No analysis yet</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Identify the current level first, or generate all Bloom variants to see the full cognitive ladder for this question.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-[0.52fr_0.48fr]">
                <div className={`rounded-[22px] border p-5 ${identifiedLevelMeta?.tone || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em]">Current classification</p>
                  <p className="mt-3 text-3xl font-bold">
                    Level {analyzeResult.level}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{analyzeResult.level_name}</p>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{analyzeResult.description}</p>
                </div>
                <div className="surface-subtle p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Model confidence</p>
                  <p className="mt-3 text-3xl font-bold text-slate-950">
                    {Math.round((analyzeResult.confidence || 0.7) * 100)}%
                  </p>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Use this as a teaching starting point, then compare alternate versions below if you want a different depth of thinking.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-[#18181b]">Targeted rewrite</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Generate one exact level on purpose.</h2>
              </div>
              <Sparkles className="mt-1 h-5 w-5 text-[#18181b]" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {BLOOM_LEVELS.map((item) => {
                const active = targetLevel === item.level
                return (
                  <button
                    key={item.level}
                    onClick={() => setTargetLevel(item.level)}
                    className={`rounded-[18px] border px-4 py-4 text-left transition ${
                      active ? `${item.tone} ring-2 ring-offset-2 ring-[#d4d4d8]` : `${item.tone} opacity-85 hover:opacity-100`
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em]">Level {item.level}</p>
                    <p className="mt-2 text-sm font-bold">{item.name}</p>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleConvertQuestion}
              disabled={!targetLevel || !analyzeResult || converting}
              className="btn btn-primary mt-5 w-full justify-center"
            >
              {converting ? 'Generating selected rewrite...' : 'Generate Selected Level'}
            </button>

            {convertedVariant && (
              <div className="surface-subtle mt-5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected level rewrite</p>
                <p className="mt-3 text-lg font-bold text-slate-950">
                  Level {convertedVariant.bloom_level} - {convertedVariant.bloom_level_name}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{convertedVariant.text}</p>
                <p className="mt-3 text-xs italic text-slate-500">{convertedVariant.reasoning}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker text-slate-500">Comparison view</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Bloom ladder for this same question.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Generate all levels to compare how the same prompt changes across recall, understanding, application, analysis, evaluation, and creation.
            </p>
          </div>
        </div>

        {allVariants.length === 0 ? (
          <div className="surface-subtle mt-5 p-6">
            <p className="text-sm font-semibold text-slate-900">No variants generated yet</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use <strong>Generate All Bloom Levels</strong> above to build the full set of question variants.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {allVariants.map((variant) => {
              const tone = BLOOM_LEVELS.find((item) => item.level === variant.bloom_level)?.tone || 'border-slate-200 bg-slate-50 text-slate-700'
              const isOriginal = variant.bloom_level === analyzeResult?.level
              return (
                <div key={variant.bloom_level} className={`rounded-[22px] border p-5 ${tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em]">Level {variant.bloom_level}</p>
                      <h3 className="mt-2 text-lg font-bold">{variant.bloom_level_name}</h3>
                    </div>
                    {isOriginal && (
                      <div className="role-pill border-slate-300 bg-white/70 text-slate-700">Original</div>
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-800">{variant.text}</p>
                  <p className="mt-4 text-xs italic text-slate-600">{variant.reasoning}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </AppShell>
  )
}
