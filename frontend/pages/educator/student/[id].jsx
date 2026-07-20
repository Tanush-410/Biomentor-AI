import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'

import AppShell from '../../../components/AppShell'
import CircularProgress from '../../../components/CircularProgress'
import ProctorReviewPanel from '../../../components/ProctorReviewPanel'
import { useAuth } from '../../../context/AuthContext'
import { requestBackendJson } from '../../../lib/backendApi'

const BLOOM_ORDER = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']

export default function StudentAnalyticsPage() {
  const router = useRouter()
  const { id } = router.query
  const { token, user, loading: authLoading } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [lessonForm, setLessonForm] = useState({ title: '', instructions: '', target_bloom_level: 3 })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading || !id) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!['educator', 'admin'].includes(user?.role)) {
      router.push('/dashboard')
      return
    }
    loadAnalytics()
  }, [authLoading, id, token, user])

  const bloomBars = useMemo(() => {
    const stats = analytics?.progress?.bloomLevelStats || {}
    return BLOOM_ORDER.map((name, index) => {
      const level = index + 1
      return { level, name, average: Math.round(stats[level]?.average || 0), count: stats[level]?.count || 0 }
    })
  }, [analytics])

  const loadAnalytics = async () => {
    try {
      const payload = await requestBackendJson(`/educator/student-analytics/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAnalytics(payload)
    } catch (err) {
      setError(err.message || 'Could not load student analytics')
    }
  }

  const assignLesson = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await requestBackendJson('/educator/lessons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { ...lessonForm, student_id: id, target_bloom_level: Number(lessonForm.target_bloom_level) }
      })
      setLessonForm({ title: '', instructions: '', target_bloom_level: 3 })
      loadAnalytics()
    } catch (err) {
      setError(err.message || 'Could not assign lesson')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell
      title={analytics?.student?.full_name || 'Student Analytics'}
      eyebrow="Educator Intervention"
      description="Inspect Bloom’s mastery, identify gap alerts, and assign tailored reinforcement lessons."
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-[#d4d4d8] bg-[#f4f4f5] px-4 py-3 text-[#27272a]">{error}</div>}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Mastery by Bloom’s Level</h2>
          <div className="mt-5 space-y-4">
            {bloomBars.map((item) => (
              <div key={item.level} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Level {item.level} • {item.name}</span>
                    <p className="mt-2 text-sm text-slate-600">{item.count} answers recorded at this Bloom level.</p>
                  </div>
                  <CircularProgress
                    value={item.average}
                    size={82}
                    stroke={8}
                    label="Mastery"
                    caption={`${item.count} answers`}
                    progressClassName="stroke-[#a88a26]"
                    trackClassName="stroke-[#d4d4d8]"
                    tone="text-[#27272a]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Gap Alerts</h2>
          <div className="mt-4 space-y-3">
            {(analytics?.gaps || []).length === 0 ? (
              <p className="text-slate-600">No gaps recorded yet.</p>
            ) : (
              analytics.gaps.map((gap) => (
                <div key={gap.level} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{gap.level}</p>
                  <p className="mt-1 text-sm text-slate-600">Gap: {Math.round(gap.gap_percentage)}%</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Assign Reinforcement Lesson</h2>
          <form onSubmit={assignLesson} className="mt-5 space-y-4">
            <input
              value={lessonForm.title}
              onChange={(e) => setLessonForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Lesson title"
              className="input"
              required
            />
            <select
              value={lessonForm.target_bloom_level}
              onChange={(e) => setLessonForm((prev) => ({ ...prev, target_bloom_level: e.target.value }))}
              className="input"
            >
              {BLOOM_ORDER.map((name, index) => (
                <option key={name} value={index + 1}>Level {index + 1} • {name}</option>
              ))}
            </select>
            <textarea
              value={lessonForm.instructions}
              onChange={(e) => setLessonForm((prev) => ({ ...prev, instructions: e.target.value }))}
              placeholder="What should this student review and practice next?"
              rows={5}
              className="input"
              required
            />
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Assigning...' : 'Assign lesson'}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Assigned Lessons</h2>
          <div className="mt-5 space-y-4">
            {(analytics?.lessons || []).length === 0 ? (
              <p className="text-slate-600">No reinforcement lessons assigned yet.</p>
            ) : (
              analytics.lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-lg font-bold text-slate-900">{lesson.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{lesson.instructions}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                    Level {lesson.target_bloom_level || '—'} • {lesson.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <ProctorReviewPanel
        review={analytics?.proctoring_review}
        compact
        title="AI Proctor Review"
      />
    </AppShell>
  )
}
