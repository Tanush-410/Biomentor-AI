import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BarChart3, Brain, MessageSquare, School2, Users } from 'lucide-react'

import AppShell from '../AppShell'
import AISpotlightBanner from '../AISpotlightBanner'
import StatCard from '../StatCard'
import { CopilotPriorityCard, EducatorCopilotPanel } from '../EducatorCopilotPanel'
import { useAuth } from '../../context/AuthContext'
import { fetchBackendWithFallback, readErrorDetail, toWebSocketBase } from '../../lib/backendApi'
import ClassroomMasteryChart from './ClassroomMasteryChart'
import DashboardTabs from './DashboardTabs'

function normalizeList(value) {
  return Array.isArray(value) ? value : []
}

function normalizeObjectList(value) {
  return normalizeList(value).filter((item) => item && typeof item === 'object' && !Array.isArray(item))
}

function normalizeStringList(value) {
  return normalizeList(value).filter((item) => typeof item === 'string')
}

function normalizeEducatorDashboardPayload(payload, messages) {
  return {
    ...(payload || {}),
    overview: payload?.overview && typeof payload.overview === 'object' ? payload.overview : {},
    alerts: normalizeObjectList(payload?.alerts),
    classrooms: normalizeObjectList(payload?.classrooms),
    complaints: normalizeObjectList(payload?.complaints),
    live_sessions: normalizeObjectList(payload?.live_sessions),
    messages: normalizeObjectList(messages),
  }
}

function normalizeEducatorCopilotPayload(payload) {
  if (!payload) return null
  return {
    ...payload,
    priorities: normalizeObjectList(payload?.priorities),
    meeting_follow_ups: normalizeStringList(payload?.meeting_follow_ups),
    intervention_plan: normalizeStringList(payload?.intervention_plan),
  }
}

export default function EducatorDashboard() {
  const { token, user } = useAuth()
  const [educatorData, setEducatorData] = useState(null)
  const [educatorCopilot, setEducatorCopilot] = useState(null)
  const [liveNotifications, setLiveNotifications] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    loadEducatorDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token) return undefined

    const apiBase = toWebSocketBase()
    if (!apiBase) return undefined

    const notificationsPath = `/api/educator/notifications/ws?token=${encodeURIComponent(token)}`
    const wsCandidates = [apiBase + notificationsPath]
    if (typeof window !== 'undefined') {
      const hostProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      wsCandidates.push(`${hostProtocol}://${window.location.host}${notificationsPath}`)
    }
    let ws

    for (const candidate of wsCandidates) {
      try {
        ws = new WebSocket(candidate)
        break
      } catch (wsSetupError) {
        console.error('Educator notification socket setup error', wsSetupError)
      }
    }

    if (!ws) {
      return undefined
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'complaint' && payload.complaint) {
          setLiveNotifications((current) => [payload.complaint, ...current].slice(0, 8))
          setEducatorData((current) => {
            if (!current) return current
            return {
              ...current,
              complaints: [payload.complaint, ...normalizeList(current.complaints)].slice(0, 8),
              alerts: [
                {
                  student_id: payload.complaint.student_id,
                  student_name: payload.complaint.student_name,
                  severity: payload.complaint.priority,
                  message: `Complaint raised: ${payload.complaint.subject}`,
                  type: 'complaint',
                  complaint_id: payload.complaint.id
                },
                ...normalizeList(current.alerts)
              ].slice(0, 10)
            }
          })
        }
        if (payload.type === 'student_message' && payload.message) {
          setLiveNotifications((current) => [payload.message, ...current].slice(0, 8))
          setEducatorData((current) => {
            if (!current) return current
            return {
              ...current,
              messages: [payload.message, ...normalizeList(current.messages)].slice(0, 12),
            }
          })
        }
        if (payload.type === 'quiz_violation' && payload.violation) {
          setLiveNotifications((current) => [payload.violation, ...current].slice(0, 8))
          setEducatorData((current) => {
            if (!current) return current
            return {
              ...current,
              alerts: [
                {
                  student_id: payload.violation.student_id,
                  student_name: payload.violation.student_name,
                  severity: 'high',
                  message: `Proctoring alert in ${payload.violation.classroom_name}: ${payload.violation.violation_type}`,
                  type: 'quiz_violation',
                  quiz_id: payload.violation.quiz_id
                },
                ...normalizeList(current.alerts)
              ].slice(0, 10)
            }
          })
        }
      } catch (wsError) {
        console.error('Educator notification parse error', wsError)
      }
    }

    return () => ws.close()
  }, [token])

  const loadEducatorDashboard = async () => {
    setError('')
    try {
      const [dashboardResponse, messagesResponse, copilotResponse] = await Promise.all([
        fetchBackendWithFallback('/educator/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/educator/messages', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/educator/copilot/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      ])

      if (!dashboardResponse.ok) {
        throw new Error((await readErrorDetail(dashboardResponse)) || 'Unable to load educator dashboard')
      }

      const dashboard = await dashboardResponse.json()
      const messages = messagesResponse.ok ? await messagesResponse.json() : { messages: [] }
      const copilot = copilotResponse.ok ? await copilotResponse.json() : null
      setEducatorData(normalizeEducatorDashboardPayload(dashboard, messages.messages))
      setEducatorCopilot(normalizeEducatorCopilotPayload(copilot))
    } catch (err) {
      console.error('Educator dashboard load error:', err)
      setError(err.message || 'Unable to connect to the server.')
    }
  }

  const educatorAlerts = normalizeList(educatorData?.alerts)
  const educatorLiveSessions = normalizeList(educatorData?.live_sessions)
  const educatorClassrooms = normalizeList(educatorData?.classrooms)
  const educatorMessages = normalizeList(educatorData?.messages)
  const educatorComplaints = normalizeList(educatorData?.complaints)
  const copilotPriorities = normalizeList(educatorCopilot?.priorities)
  const copilotMeetingFollowUps = normalizeList(educatorCopilot?.meeting_follow_ups)
  const copilotInterventionPlan = normalizeList(educatorCopilot?.intervention_plan)
  const activeComplaints = liveNotifications.length > 0 ? liveNotifications : educatorComplaints

  return (
    <AppShell
      title="Educator Command Center"
      eyebrow={user?.role === 'admin' ? 'VYDRA CORE Admin' : 'VYDRA CORE Educator'}
      description="Move from class overview to intervention, live collaboration, communication, and institutional insight from one role-aware workspace."
      contentClassName="space-y-8"
      actions={
        <>
          <Link href="/educator/classrooms" className="btn btn-outline">Classrooms</Link>
          <Link href="/educator/quiz-maker" className="btn btn-primary">Quiz Maker</Link>
          <Link href="/check-difficulty" className="btn btn-outline">SOLO Studio</Link>
          <Link href="/collaboration-hub" className="btn btn-primary">Launch Session</Link>
          <Link href="/communication-hub" className="btn btn-outline">Send Update</Link>
        </>
      }
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}

      {/* At a glance */}
      <section>
        <h2 className="section-kicker text-zinc-500">At a glance</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Classrooms" value={educatorData?.overview?.classrooms || 0} accent="bg-[#f4f4f5] text-[#18181b]" icon={<School2 className="w-5 h-5" />} />
          <StatCard label="Students" value={educatorData?.overview?.students || 0} accent="bg-[#d4d4d8] text-[#3f3f46]" icon={<Users className="w-5 h-5" />} />
          <StatCard label="Avg Mastery" value={`${Math.round(educatorData?.overview?.average_mastery || 0)}%`} accent="bg-[#e4e4e7] text-[#18181b]" icon={<BarChart3 className="w-5 h-5" />} />
          <StatCard label="Top Gap" value={educatorData?.overview?.top_gap || 'N/A'} accent="bg-zinc-200 text-zinc-700" icon={<AlertTriangle className="w-5 h-5" />} />
        </div>
      </section>

      <DashboardTabs
        defaultTab="overview"
        tabs={[
          {
            key: 'overview',
            label: 'Overview',
            badge: educatorAlerts.length,
            content: (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="card p-6">
                  <h3 className="text-xl font-bold text-slate-900">Struggling Student Alerts</h3>
                  <p className="text-sm text-slate-600">AI-prioritized students who may need reinforcement lessons or quick outreach.</p>
                  <div className="mt-5 space-y-4">
                    {educatorAlerts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                        No active alerts yet. Once students complete quizzes, this panel will flag shared gaps and mastery concerns.
                      </div>
                    ) : (
                      educatorAlerts.slice(0, 4).map((alert, index) => (
                        <div key={alert.complaint_id || `${alert.student_id}-${alert.type || 'gap'}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{alert.severity} priority</p>
                              <h4 className="text-lg font-bold text-slate-900">{alert.student_name}</h4>
                              <p className="text-sm text-slate-600">{alert.message}</p>
                            </div>
                            <Link href={`/educator/student/${alert.student_id}`} className="btn btn-outline">View Analytics</Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <EducatorCopilotPanel
                    title="Educator Command Center"
                    summary={educatorCopilot?.summary || 'The copilot is watching complaints, low-mastery students, and meeting follow-ups so you can act quickly.'}
                    actionLabel="Open Communication Hub"
                    actionHref="/communication-hub"
                  >
                    {copilotPriorities.length === 0 ? (
                      <div className="surface-subtle p-4 text-sm text-slate-600">
                        No urgent copilot actions yet. New quiz results, complaints, and meeting recaps will surface here automatically.
                      </div>
                    ) : (
                      copilotPriorities.slice(0, 3).map((item) => (
                        <CopilotPriorityCard key={item.id} item={item} data-confidence-reason={item.confidence_reason || ''} />
                      ))
                    )}
                    {copilotMeetingFollowUps.length > 0 && (
                      <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Meeting follow-ups</p>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                          {copilotMeetingFollowUps.slice(0, 3).map((item, index) => (
                            <p key={`${item}-${index}`}>• {item}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {copilotInterventionPlan.length > 0 && (
                      <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Intervention plan</p>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                          {copilotInterventionPlan.slice(0, 3).map((item, index) => (
                            <p key={`${item}-${index}`}>• {item}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </EducatorCopilotPanel>
                </div>
              </section>
            ),
          },
          {
            key: 'performance',
            label: 'Performance',
            content: (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="card p-6">
                  <h3 className="mb-1 text-xl font-bold text-slate-900">Average Mastery by Classroom</h3>
                  <p className="mb-4 text-sm text-slate-600">Where classes stand right now, ranked by quiz performance.</p>
                  <ClassroomMasteryChart classrooms={educatorClassrooms} />
                </div>

                <div className="card p-6">
                  <h3 className="text-xl font-bold text-slate-900">Classroom Snapshot</h3>
                  <div className="mt-4 space-y-4">
                    {educatorClassrooms.length === 0 ? (
                      <p className="text-slate-600">Create your first classroom to start inviting students.</p>
                    ) : (
                      educatorClassrooms.map((room) => (
                        <div key={room.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h4 className="text-lg font-bold text-slate-900">{room.name}</h4>
                              <p className="text-sm text-slate-600">{room.subject} • invite code {room.invite_code}</p>
                            </div>
                            <div className="text-sm text-slate-600">
                              <p>{room.student_count} students</p>
                              <p>{room.average_mastery}% mastery</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            ),
          },
          {
            key: 'communication',
            label: 'Communication',
            badge: activeComplaints.length,
            content: (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Student Complaints Inbox</h3>
                      <p className="text-sm text-slate-600">Difficulty reports appear here as soon as they&apos;re submitted.</p>
                    </div>
                    {liveNotifications.length > 0 && (
                      <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#18181b]">Live</span>
                    )}
                  </div>
                  <div className="mt-5 space-y-4">
                    {activeComplaints.length === 0 ? (
                      <p className="text-slate-600">No complaints raised yet.</p>
                    ) : (
                      activeComplaints.slice(0, 4).map((complaint) => (
                        <div key={complaint.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                {complaint.priority || complaint.severity || 'high'} priority
                              </p>
                              <h4 className="text-lg font-bold text-slate-900">
                                {complaint.subject || complaint.title || 'Proctoring alert'}
                              </h4>
                              <p className="mt-1 text-sm text-slate-600">
                                {complaint.student_name || complaint.sender_name || 'Student'} • {complaint.classroom_name || 'Classroom'}
                              </p>
                            </div>
                            <Link href="/communication-hub" className="btn btn-outline">Respond</Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="card p-6">
                    <h3 className="text-xl font-bold text-slate-900">Recent Communications</h3>
                    <div className="mt-4 space-y-4">
                      {educatorMessages.length === 0 ? (
                        <p className="text-slate-600">No messages yet. Send your first class update from the Communication Hub.</p>
                      ) : (
                        educatorMessages.map((message) => (
                          <div key={message.id} className="rounded-2xl border border-slate-200 p-4">
                            <p className="text-sm font-semibold text-slate-900">{message.subject}</p>
                            <p className="mt-2 text-sm text-slate-600">{message.content}</p>
                            <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{message.audience}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="card p-6">
                    <h3 className="text-xl font-bold text-slate-900">Quick Actions</h3>
                    <div className="mt-4 space-y-3">
                      <Link href="/communication-hub" className="btn btn-outline inline-flex w-full items-center justify-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Open Communication Hub
                      </Link>
                      <Link href="/collaboration-hub" className="btn btn-primary inline-flex w-full items-center justify-center gap-2">
                        <Brain className="h-4 w-4" />
                        Run Live Polls and Quick Checks
                      </Link>
                      {user?.role === 'admin' && (
                        <Link href="/admin/analytics" className="btn btn-outline inline-flex w-full items-center justify-center gap-2">
                          <Users className="h-4 w-4" />
                          Open Admin Analytics
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ),
          },
          {
            key: 'live',
            label: 'Live & AI',
            badge: educatorLiveSessions.length,
            content: (
              <>
                <div className="card p-6">
                  <h3 className="text-xl font-bold text-slate-900">Live Collaboration</h3>
                  <div className="mt-4 space-y-3">
                    {educatorLiveSessions.length === 0 ? (
                      <p className="text-slate-600">No live sessions running right now.</p>
                    ) : (
                      educatorLiveSessions.slice(0, 4).map((session) => (
                        <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">{session.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{session.status}</p>
                          <p className="mt-2 text-sm text-slate-600">Join code: {session.join_code}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/collaboration-hub" className="btn btn-primary inline-flex items-center justify-center gap-2">
                      <Brain className="h-4 w-4" />
                      Launch Collaboration Hub
                    </Link>
                  </div>
                </div>

                <AISpotlightBanner
                  eyebrow="Educator AI Surface"
                  title="AI Mission Control"
                  description="Intervention priorities, meeting follow-through, and class response decisions surfaced before you dig through dashboards."
                  highlights={['Intervention priorities', 'Meeting follow-ups', 'Classroom risk signals']}
                  primaryAction={{ label: 'Open Communication Hub', href: '/communication-hub' }}
                  secondaryAction={{ label: 'Launch Collaboration Hub', href: '/collaboration-hub' }}
                />
              </>
            ),
          },
        ]}
      />
    </AppShell>
  )
}
