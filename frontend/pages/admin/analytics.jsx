import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import CircularProgress from '../../components/CircularProgress'
import { useAuth } from '../../context/AuthContext'
import { requestBackendJson } from '../../lib/backendApi'

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    if (user?.role !== 'admin') {
      router.push('/dashboard')
      return
    }
    loadAnalytics()
  }, [authLoading, token, user])

  const loadAnalytics = async () => {
    try {
      const payload = await requestBackendJson('/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAnalytics(payload)
    } catch (err) {
      setError(err.message || 'Could not load admin analytics')
    }
  }

  return (
    <AppShell
      title="Institution Analytics"
      eyebrow="Admin Mode"
      description="Track institutional performance, compare classrooms, review complaint pressure, and monitor collaboration usage from one clearer oversight view."
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Users" value={analytics?.overview?.users || 0} />
        <StatCard label="Students" value={analytics?.overview?.students || 0} />
        <StatCard label="Educators" value={analytics?.overview?.educators || 0} />
        <StatCard label="Classrooms" value={analytics?.overview?.classrooms || 0} />
        <StatCard label="Messages" value={analytics?.overview?.messages_sent || 0} />
        <StatCard label="Open Complaints" value={analytics?.overview?.open_complaints || 0} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Mastery by Role</h2>
          <div className="mt-5 space-y-4">
            {(analytics?.mastery_by_role || []).map((item) => (
              <div key={item.role} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-semibold text-slate-900">{item.role}</span>
                    <p className="mt-2 text-sm text-slate-600">{item.count} accounts measured.</p>
                  </div>
                  <CircularProgress
                    value={item.average_mastery}
                    size={82}
                    stroke={8}
                    label="Average mastery"
                    caption={`${item.count} accounts`}
                    progressClassName="stroke-[#c9ab3f]"
                    trackClassName="stroke-[#d4d4d8]"
                    tone="text-[#18181b]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Complaint Pressure</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MiniPill label="Open" value={analytics?.complaint_summary?.open || 0} tone="bg-[#e4e4e7] text-[#18181b]" />
            <MiniPill label="Resolved" value={analytics?.complaint_summary?.resolved || 0} tone="bg-[#d4d4d8] text-[#3f3f46]" />
            <MiniPill label="High Priority" value={analytics?.complaint_summary?.high_priority || 0} tone="bg-zinc-200 text-zinc-700" />
          </div>
          <div className="mt-6 space-y-3 text-slate-700">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              Live sessions: {analytics?.engagement?.live_sessions || 0}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              Assignments: {analytics?.engagement?.assignments || 0}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              Total complaints raised: {analytics?.engagement?.complaints || 0}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Class Comparison View</h2>
          <div className="mt-5 space-y-4">
            {(analytics?.class_comparisons || []).length === 0 ? (
              <p className="text-slate-600">No classrooms available yet.</p>
            ) : (
              analytics.class_comparisons.map((item) => (
                <div key={item.classroom_id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{item.classroom_name}</h3>
                      <p className="text-sm text-slate-600">{item.student_count} students • {item.open_complaints} open complaints</p>
                    </div>
                    <CircularProgress
                      value={item.average_mastery}
                      size={84}
                      stroke={8}
                      label="Average mastery"
                      caption={`${item.student_count} students`}
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

        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-950">Recent Live Sessions</h2>
          <div className="mt-5 space-y-4">
            {(analytics?.live_sessions || []).map((session) => (
              <div key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{session.title}</p>
                <p className="mt-2 text-sm uppercase tracking-wide text-slate-500">{session.status}</p>
                <p className="mt-2 text-sm text-slate-600">{new Date(session.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  )
}

function MiniPill({ label, value, tone }) {
  return (
    <div className={`rounded-2xl px-4 py-5 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}
