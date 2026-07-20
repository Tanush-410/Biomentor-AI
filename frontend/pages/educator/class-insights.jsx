import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import AISpotlightBanner from '../../components/AISpotlightBanner'
import CircularProgress from '../../components/CircularProgress'
import { CopilotRecommendationCard, EducatorCopilotPanel } from '../../components/EducatorCopilotPanel'
import { useAuth } from '../../context/AuthContext'
import { requestBackendJson } from '../../lib/backendApi'

export default function ClassInsightsPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [insights, setInsights] = useState(null)
  const [copilot, setCopilot] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!['educator', 'admin'].includes(user?.role)) {
      router.push('/dashboard')
      return
    }
    loadInsights()
  }, [authLoading, token, user])

  const loadInsights = async () => {
    try {
      const [payload, copilotPayload] = await Promise.all([
        requestBackendJson('/educator/class-insights', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        requestBackendJson('/educator/copilot/class-insights', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null)
      ])
      setInsights(payload)
      setCopilot(copilotPayload)
    } catch (err) {
      setError(err.message || 'Could not load class insights')
    }
  }

  return (
    <AppShell
      title="Class Insights"
      eyebrow="Educator Analytics"
      description="Analyze topic-level trends, shared learning gaps, and group-review priorities across your classrooms."
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-[#d5b598] bg-[#f5e7d8] px-4 py-3 text-[#7a5030]">{error}</div>}

      <AISpotlightBanner
        eyebrow="Insights AI Surface"
        title="Insight Command Deck"
        description="This is the educator-facing AI deck for class-wide patterns. Use it to see what topics are slipping, which reteach move matters most, and how the copilot wants you to run the next review cycle."
        highlights={['Topic trend diagnosis', 'Group review moves', 'Teaching sequence guidance']}
        primaryAction={{ label: 'Open Insight Copilot', href: '#insight-copilot' }}
        secondaryAction={{ label: 'Jump to Topic Trends', href: '#topic-trends' }}
        status="This deck turns quiz and classroom signals into teaching decisions, so class insight leads directly to class action."
      />

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classrooms" value={insights?.overview?.classrooms || 0} />
        <StatCard label="Students Measured" value={insights?.overview?.students_measured || 0} />
        <StatCard label="Weakest Topic" value={insights?.topic_trends?.[0]?.topic || 'N/A'} />
        <StatCard label="Best Topic" value={insights?.topic_trends?.[insights?.topic_trends?.length - 1]?.topic || 'N/A'} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div id="topic-trends" className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Topic-Level Trends</h2>
          <div className="mt-5 space-y-4">
            {(insights?.topic_trends || []).length === 0 ? (
              <p className="text-slate-600">No topic trends yet. Once students finish quizzes, this chart will populate.</p>
            ) : (
              insights.topic_trends.map((item) => (
                <div key={item.topic} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">{item.topic}</span>
                      <p className="mt-2 text-sm text-slate-600">{item.students_measured} students measured in this topic.</p>
                    </div>
                    <CircularProgress
                      value={item.mastery}
                      size={82}
                      stroke={8}
                      label="Topic mastery"
                      caption={`${item.students_measured} students`}
                      progressClassName="stroke-[#c9ab3f]"
                      trackClassName="stroke-[#d4d4d8]"
                      tone="text-[#18181b]"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div id="insight-copilot">
          <EducatorCopilotPanel
            title="Educator Command Center"
            summary={copilot?.overview_summary}
          >
            <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-[#18181b]">Teaching move</p>
              <p className="mt-1">The copilot explains the exact reteach move it recommends for each weak topic.</p>
              <p className="mt-3 font-semibold text-[#18181b]">Review sequence</p>
              <p className="mt-1">Group-review suggestions now include a clearer sequence for how the educator should run the reteach cycle.</p>
            </div>
            {(copilot?.trend_explanations || []).length === 0 ? (
              <div className="surface-subtle p-4 text-sm text-slate-600">
                No copilot recommendations yet. Once quizzes generate topic-level trends, this panel will explain what to reteach next.
              </div>
            ) : (
              (copilot?.trend_explanations || []).map((item) => (
                <CopilotRecommendationCard key={`explanation-${item.topic}`} item={item} data-confidence-reason={item.confidence_reason || ''} />
              ))
            )}
            {(copilot?.group_review_recommendations || []).length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Group review recommendations</p>
                {copilot.group_review_recommendations.map((item, index) => (
                  <CopilotRecommendationCard key={`recommendation-${item.topic}-${index}`} item={item} data-confidence-reason={item.confidence_reason || ''} />
                ))}
              </div>
            )}
          </EducatorCopilotPanel>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-bold text-slate-950">Recommended Group Reviews</h2>
        <div className="mt-5 space-y-3">
          {(insights?.recommended_group_reviews || []).length === 0 ? (
            <p className="text-slate-600">No group-review recommendations yet.</p>
          ) : (
            insights.recommended_group_reviews.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                {item}
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#876651]">{label}</p>
      <p className="mt-4 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  )
}
