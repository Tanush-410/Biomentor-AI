import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Brain } from 'lucide-react'

import AppShell from '../components/AppShell'
import GapAnalysisPanel from '../components/GapAnalysisPanel'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

export default function GapAnalysisPage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [topicGaps, setTopicGaps] = useState([])
  const [gapTrend, setGapTrend] = useState([])
  const [recommendations, setRecommendations] = useState(null)
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
      const [topicPayload, trendPayload, recommendationsPayload] = await Promise.all([
        requestBackendJson('/gaps/topics', authHeaders),
        requestBackendJson('/gaps/trend', authHeaders),
        requestBackendJson('/recommendations/study-plan', authHeaders).catch(() => null)
      ])
      setTopicGaps(topicPayload?.topic_gaps || [])
      setGapTrend(trendPayload?.trend || [])
      setRecommendations(recommendationsPayload?.recommendations || null)
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

      <GapAnalysisPanel
        topicGaps={topicGaps}
        gapTrend={gapTrend}
        loading={loading}
        onPracticeTopic={practiceTopic}
        recommendations={recommendations}
      />
    </AppShell>
  )
}
