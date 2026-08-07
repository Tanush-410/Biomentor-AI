import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AlertTriangle, Brain, History, Target } from 'lucide-react'

import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

export default function GapAnalysisPage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [topicGaps, setTopicGaps] = useState([])
  const [gapTrend, setGapTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    fetchGapData()
  }, [authLoading, token])

  const fetchGapData = async () => {
    setLoading(true)
    setError('')
    try {
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } }
      const [topicPayload, trendPayload] = await Promise.all([
        requestBackendJson('/gaps/topics', authHeaders),
        requestBackendJson('/gaps/trend', authHeaders)
      ])
      setTopicGaps(topicPayload?.topic_gaps || [])
      setGapTrend(trendPayload?.trend || [])
    } catch (err) {
      console.error('Gap analysis load error:', err)
      setError(err.message || 'Unable to load gap analysis right now.')
    } finally {
      setLoading(false)
    }
  }

  const practiceTopic = (topic) => {
    if (topic.document_id) {
      router.push(`/start-quiz?doc_id=${encodeURIComponent(topic.document_id)}`)
    } else {
      router.push('/start-quiz')
    }
  }

  return (
    <AppShell
      title="Gap Analysis"
      eyebrow="Where to focus next"
      description="Every quiz and Learning Chat quick check feeds this automatically -- see exactly which topics you're weak on, track whether you're improving, and jump straight into a quiz for any of them."
      contentClassName="space-y-8"
      actions={
        <Link href="/start-quiz" className="btn btn-outline inline-flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Generate Quiz
        </Link>
      }
    >
      {error && (
        <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">
          {error}
        </div>
      )}

      <section className="card p-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Current weak topics</p>
            <h2 className="text-xl font-bold text-slate-900">What to work on</h2>
          </div>
        </div>
        <p className="text-slate-600 mb-6">
          Ranked worst-first, based on your real quiz and quick-check answers, mapped back to the material each
          question came from.
        </p>

        {loading ? (
          <p className="text-slate-500">Loading your gap analysis...</p>
        ) : topicGaps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
            No gap data yet. Complete a quiz or answer a Learning Chat quick check, and your weak topics will
            show up here automatically.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {topicGaps.map((topic) => (
              <div key={topic.topic} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{topic.topic}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {topic.answered_count} answer{topic.answered_count === 1 ? '' : 's'} tracked
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#fdf6df] px-2.5 py-1 text-xs font-semibold text-[#8a6d1a]">
                    <AlertTriangle className="h-3 w-3" />
                    {topic.gap_percentage}% gap
                  </span>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#c9ab3f]"
                    style={{ width: `${Math.max(4, topic.mastery_percentage)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">{topic.mastery_percentage}% mastery</p>

                <button
                  type="button"
                  onClick={() => practiceTopic(topic)}
                  className="btn btn-primary mt-4 w-full inline-flex items-center justify-center gap-2"
                >
                  <Brain className="w-4 h-4" />
                  Generate quiz on this topic
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Over time</p>
            <h2 className="text-xl font-bold text-slate-900">Are you improving?</h2>
          </div>
        </div>
        <p className="text-slate-600 mb-6">
          Every completed quiz and quick check adds a new point here, so you can see whether a topic is actually
          getting better or staying stuck.
        </p>

        {loading ? (
          <p className="text-slate-500">Loading history...</p>
        ) : gapTrend.length === 0 ? (
          <p className="text-slate-600">No history recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {gapTrend.slice(-15).reverse().map((point, index) => (
              <div
                key={`${point.topic}-${point.recorded_at || index}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{point.topic}</p>
                  <p className="text-xs text-slate-500">
                    {point.recorded_at ? new Date(point.recorded_at).toLocaleString() : 'Unknown time'}
                    {' · '}
                    {point.source === 'quick_check' ? 'Quick check' : 'Quiz'}
                  </p>
                </div>
                <span className="font-semibold text-slate-700">{Math.round(point.mastery_score)}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  )
}
