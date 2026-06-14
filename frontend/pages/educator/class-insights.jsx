import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import CircularProgress from '../../components/CircularProgress'
import { CopilotRecommendationCard, EducatorCopilotPanel } from '../../components/EducatorCopilotPanel'
import { useAuth } from '../../context/AuthContext'

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
      const [response, copilotResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/educator/class-insights`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/educator/copilot/class-insights`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])
      const payload = await response.json().catch(() => ({}))
      const copilotPayload = await copilotResponse.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.detail || 'Could not load class insights')
      }
      setInsights(payload)
      setCopilot(copilotResponse.ok ? copilotPayload : null)
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

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classrooms" value={insights?.overview?.classrooms || 0} />
        <StatCard label="Students Measured" value={insights?.overview?.students_measured || 0} />
        <StatCard label="Weakest Topic" value={insights?.topic_trends?.[0]?.topic || 'N/A'} />
        <StatCard label="Best Topic" value={insights?.topic_trends?.[insights?.topic_trends?.length - 1]?.topic || 'N/A'} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-6">
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
                      progressClassName="stroke-[#8a5a36]"
                      trackClassName="stroke-[#eee4da]"
                      tone="text-[#8a5a36]"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <EducatorCopilotPanel
          title="Copilot interpretation and group review guidance"
          summary={copilot?.overview_summary}
        >
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a5a36]">Group review recommendations</p>
              {copilot.group_review_recommendations.map((item, index) => (
                <CopilotRecommendationCard key={`recommendation-${item.topic}-${index}`} item={item} data-confidence-reason={item.confidence_reason || ''} />
              ))}
            </div>
          )}
        </EducatorCopilotPanel>
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
