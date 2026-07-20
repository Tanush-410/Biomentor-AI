import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AlertTriangle, BarChart3, BookOpen, Brain, FileText, MessageSquare, School2, Sparkles, Users } from 'lucide-react'

import AppShell from '../components/AppShell'
import AISpotlightBanner from '../components/AISpotlightBanner'
import CircularProgress from '../components/CircularProgress'
import { CopilotPriorityCard, EducatorCopilotPanel } from '../components/EducatorCopilotPanel'
import { StudyCoachActionList, StudyCoachPanel } from '../components/StudyCoachPanel'
import { useAuth } from '../context/AuthContext'
import { fetchBackendWithFallback, readErrorDetail, toWebSocketBase } from '../lib/backendApi'

const BLOOM_LABELS = {
  1: 'Remember',
  2: 'Understand',
  3: 'Apply',
  4: 'Analyze',
  5: 'Evaluate',
  6: 'Create'
}

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

export default function Dashboard() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [studentData, setStudentData] = useState({ documents: [], progress: null, studyPlan: null })
  const [studyCoach, setStudyCoach] = useState(null)
  const [educatorData, setEducatorData] = useState(null)
  const [educatorCopilot, setEducatorCopilot] = useState(null)
  const [liveNotifications, setLiveNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isEducator = user?.role === 'educator' || user?.role === 'admin'

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    if (isEducator) {
      loadEducatorDashboard()
    } else {
      loadStudentDashboard()
    }
  }, [authLoading, token, isEducator])

  useEffect(() => {
    if (!isEducator || !token) return undefined

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
  }, [isEducator, token])

  const weakAreas = useMemo(() => {
    const progress = studentData.progress
    if (!progress?.bloomLevelStats) return []

    return Object.entries(progress.bloomLevelStats)
      .map(([level, stats]) => ({
        level: Number(level),
        name: stats.name || BLOOM_LABELS[Number(level)],
        average: Math.round(stats.average || 0),
        count: stats.count || 0
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => a.average - b.average)
      .slice(0, 3)
  }, [studentData.progress])

  const recommendations = useMemo(() => {
    const { studyPlan, progress, documents } = studentData
    if (studyPlan) {
      return [...(studyPlan.immediate || []), ...(studyPlan.short_term || [])].slice(0, 4)
    }
    if (!progress) return []
    const items = []
    if (weakAreas[0]) {
      items.push(`Focus on ${weakAreas[0].name} questions next to strengthen your weakest Bloom's level.`)
    }
    if ((progress.totalQuestionsAnswered || 0) === 0) {
      items.push('Upload your first material and generate a quiz to begin tracking progress.')
    }
    if ((documents || []).length > 0 && user?.role !== 'student') {
      items.push('Use Check Difficulty to convert your own questions across Bloom’s Taxonomy levels.')
    }
    return items.slice(0, 3)
  }, [studentData, weakAreas, user])

  const loadStudentDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const [documentsResponse, progressResponse, recommendationsResponse, coachResponse] = await Promise.all([
        fetchBackendWithFallback('/documents/', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/quiz/progress', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/recommendations/study-plan', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/study-coach/overview', { headers: { Authorization: `Bearer ${token}` } })
      ])

      const documents = documentsResponse.ok ? await documentsResponse.json() : []
      const progress = progressResponse.ok ? await progressResponse.json() : null
      const recommendationsPayload = recommendationsResponse.ok ? await recommendationsResponse.json() : null
      const coachPayload = coachResponse.ok ? await coachResponse.json() : null

      setStudentData({
        documents,
        progress,
        studyPlan: recommendationsPayload?.recommendations || null
      })
      setStudyCoach(coachPayload)

      if (!documentsResponse.ok && !progressResponse.ok && !recommendationsResponse.ok) {
        setError(
          (await readErrorDetail(documentsResponse))
          || (await readErrorDetail(progressResponse))
          || (await readErrorDetail(recommendationsResponse))
          || 'We could not load your dashboard right now.'
        )
      }
    } catch (err) {
      console.error('Student dashboard load error:', err)
      setError('Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  const loadEducatorDashboard = async () => {
    setLoading(true)
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
    } finally {
      setLoading(false)
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

  if (isEducator) {
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
            <Link href="/check-difficulty" className="btn btn-outline">Bloom Studio</Link>
            <Link href="/collaboration-hub" className="btn btn-primary">Launch Session</Link>
            <Link href="/communication-hub" className="btn btn-outline">Send Update</Link>
          </>
        }
      >
        {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}

        <AISpotlightBanner
          eyebrow="Educator AI Surface"
          title="AI Mission Control"
          description="Run the educator day from one AI-first command layer: intervention priorities, meeting follow-through, and class response decisions are surfaced before you dig through dashboards."
          highlights={['Intervention priorities', 'Meeting follow-ups', 'Classroom risk signals']}
          primaryAction={{ label: 'Open Educator Copilot', href: '#educator-copilot' }}
          secondaryAction={{ label: 'Jump to Communication Hub', href: '/communication-hub#copilot-response-center' }}
          status="This is the place where VYDRA CORE decides what needs your attention now, what can wait, and what should turn into a class-wide response."
        />

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card relative overflow-hidden bg-[linear-gradient(145deg,#d9c25c,#a88a26_52%,#f2e9c4)] p-8 text-zinc-950 shadow-2xl shadow-zinc-200">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#f2e9c4]/12 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-[#fafafa]/10 blur-3xl" />
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#fafafa]">Educator/Admin Flow</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight">
              Access class overview, inspect student analytics, intervene quickly, then follow through with AI-guided collaboration.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">
              The educator mode now follows your required five-stage flow: overview, student analytics, class insights, communication, and institutional analytics.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/educator/classrooms" className="rounded-lg bg-white px-5 py-3 font-semibold text-slate-950">Open Classrooms</Link>
              <Link href="/educator/quiz-maker" className="rounded-lg border border-white/50 px-5 py-3 font-semibold text-zinc-950">Build Classroom Quiz</Link>
              <Link href="/check-difficulty" className="rounded-lg border border-white/50 px-5 py-3 font-semibold text-zinc-950">Open Bloom Studio</Link>
              <Link href="/educator/class-insights" className="rounded-lg border border-white/50 px-5 py-3 font-semibold text-zinc-950">Inspect Class Insights</Link>
              <Link href="/admin/analytics" className="rounded-lg border border-white/50 px-5 py-3 font-semibold text-zinc-950">Institution View</Link>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-xl font-bold text-slate-900">Overview</h3>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <StatCard label="Classrooms" value={educatorData?.overview?.classrooms || 0} accent="bg-[#f4f4f5] text-[#18181b]" icon={<School2 className="w-5 h-5" />} />
              <StatCard label="Students" value={educatorData?.overview?.students || 0} accent="bg-[#d4d4d8] text-[#3f3f46]" icon={<Users className="w-5 h-5" />} />
              <StatCard label="Avg Mastery" value={`${Math.round(educatorData?.overview?.average_mastery || 0)}%`} accent="bg-[#e4e4e7] text-[#18181b]" icon={<BarChart3 className="w-5 h-5" />} />
              <StatCard label="Top Gap" value={educatorData?.overview?.top_gap || 'N/A'} accent="bg-zinc-200 text-zinc-700" icon={<AlertTriangle className="w-5 h-5" />} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Struggling Student Alerts</h3>
                <p className="text-sm text-slate-600">AI-prioritized students who may need reinforcement lessons or quick outreach.</p>
              </div>
            </div>
            <div className="space-y-4">
              {educatorAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  No active alerts yet. Once students complete quizzes, this panel will flag shared gaps and mastery concerns.
                </div>
              ) : (
                educatorAlerts.map((alert) => (
                  <div key={alert.student_id} className="rounded-2xl border border-slate-200 p-4">
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

          <div className="space-y-6">
            <div id="educator-copilot">
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

            <div className="card p-6">
              <h3 className="text-xl font-bold text-slate-900">Live Collaboration</h3>
              <div className="mt-4 space-y-3">
                {educatorLiveSessions.slice(0, 4).map((session) => (
                  <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{session.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{session.status}</p>
                    <p className="mt-2 text-sm text-slate-600">Join code: {session.join_code}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                <Link href="/collaboration-hub" className="w-full btn btn-primary inline-flex items-center justify-center gap-2">
                  <Brain className="h-4 w-4" />
                  Launch Collaboration Hub
                </Link>
                <Link href="/communication-hub" className="w-full btn btn-outline inline-flex items-center justify-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Open Communication Hub
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
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
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-6">
            <h3 className="text-xl font-bold text-slate-900">Student Complaints Inbox</h3>
            <p className="mt-2 text-sm text-slate-600">Difficulty reports raised by students appear here as soon as they submit them.</p>
            <div className="mt-5 space-y-4">
              {(liveNotifications.length > 0 ? liveNotifications : educatorComplaints).length === 0 ? (
                <p className="text-slate-600">No complaints raised yet.</p>
              ) : (
                (liveNotifications.length > 0 ? liveNotifications : educatorComplaints).map((complaint) => (
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
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {complaint.content || complaint.message || `${complaint.student_name || 'A student'} triggered ${complaint.violation_type || 'a classroom alert'}.`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-xl font-bold text-slate-900">Admin and Review Shortcuts</h3>
            <div className="mt-5 space-y-3">
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
            {liveNotifications.length > 0 && (
              <div className="mt-5 rounded-2xl border border-[#d4d4d8] bg-[#e4e4e7] p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#18181b]">Live educator feed</p>
                <p className="mt-2 text-sm leading-6 text-[#3f3f46]">
                  New student messages and complaints are being surfaced in real time while this dashboard is open.
                </p>
              </div>
            )}
          </div>
        </section>
      </AppShell>
    )
  }

  const documents = studentData.documents
  const progress = studentData.progress

  return (
    <AppShell
      title="Learning Dashboard"
      description="See your uploaded study material, Bloom's quiz performance, and the next actions that keep your exam prep moving."
      contentClassName="space-y-8"
      actions={
        <>
          <Link href="/student/classrooms" className="btn btn-outline">Classroom</Link>
          <Link href="/documents" className="btn btn-outline">Materials</Link>
          <Link href="/start-quiz" className="btn btn-primary">Generate Quiz</Link>
          <Link href="/learning-chat" className="btn btn-outline">Learning Chat</Link>
        </>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card relative overflow-hidden bg-[linear-gradient(145deg,#d9c25c,#c9ab3f_55%,#f2e9c4)] p-8 text-zinc-950 shadow-xl shadow-zinc-200">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#fafafa]">AI Study Flow</p>
            <h2 className="mb-4 text-4xl font-bold leading-tight">Upload material, study offline, ask questions, then practice with Bloom’s-based quizzes.</h2>
            <p className="mb-6 text-lg text-zinc-100/90">
              This dashboard follows the flow in your VYDRA CORE document: study resources, adaptive quiz practice, and progress tracking in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/documents" className="rounded-lg bg-[#fafafa] px-5 py-3 font-semibold text-[#3f3f46] transition hover:bg-white">
                Upload or Open Materials
              </Link>
              <Link href="/start-quiz" className="rounded-lg border border-white/60 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white/10">
                Generate Quiz
              </Link>
              <Link href="/learning-chat" className="rounded-lg border border-white/60 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white/10">
                Learning Chat
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StudentSignal label="Materials" value={documents.length} />
              <StudentSignal label="Quizzes" value={progress?.totalQuizzes || 0} />
              <StudentSignal label="Avg Score" value={`${Math.round(progress?.averageScore || 0)}%`} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="mb-4 text-xl font-bold text-slate-900">Quick Snapshot</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Materials" value={documents.length} accent="bg-[#d4d4d8] text-[#3f3f46]" icon={<BookOpen className="w-5 h-5" />} />
            <StatCard label="Quizzes" value={progress?.totalQuizzes || 0} accent="bg-[#f4f4f5] text-[#18181b]" icon={<Brain className="w-5 h-5" />} />
            <StatCard label="Avg Score" value={`${Math.round(progress?.averageScore || 0)}%`} accent="bg-[#e4e4e7] text-[#18181b]" icon={<BarChart3 className="w-5 h-5" />} />
            <StatCard label="Questions" value={progress?.totalQuestionsAnswered || 0} accent="bg-zinc-200 text-zinc-700" icon={<Sparkles className="w-5 h-5" />} />
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}

      <AISpotlightBanner
        eyebrow="Student AI Surface"
        title="AI Mission Control"
        description="Your study flow now has a visible AI command layer: the coach decides what to practice next, the material engine explains what matters, and the chat switches into reasoning mode when your questions get harder."
        highlights={['Adaptive study coach', 'Material intelligence', 'Reasoning chat']}
        primaryAction={{ label: 'Open Study Coach', href: '#study-coach' }}
        secondaryAction={{ label: 'Review Material Intelligence', href: '/documents#material-intelligence-studio' }}
        status="This page is now the center of your AI-guided study loop: decide what to review, why it matters, and which move gets the biggest gain next."
      />

      <div id="study-coach">
        <StudyCoachPanel
          title="Study Coach Command"
          summary={studyCoach?.rationale || 'The coach uses your live quiz history and uploaded material to tell you what to do next.'}
          confidenceReason={studyCoach?.confidence_reason}
          actionLabel="Open Full Progress Plan"
          actionHref="/progress"
          studyMode={studyCoach?.study_mode}
          modeReason={studyCoach?.mode_reason}
          dailyGoal={studyCoach?.daily_goal}
          weeklyPlan={studyCoach?.weekly_plan}
          recoveryPath={studyCoach?.recovery_path}
        >
          {studyCoach ? (
            <>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Next best move</p>
                <p className="mt-3 text-lg font-bold text-slate-950">{studyCoach.next_action}</p>
              </div>
              {studyCoach?.daily_goal ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Today’s goal</p>
                  <p className="mt-3 text-base font-bold text-slate-950">{studyCoach.daily_goal.label}</p>
                </div>
              ) : null}
              <StudyCoachActionList actions={studyCoach.short_plan} />
              {(studyCoach.weak_focus_areas || []).length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Weak focus areas</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {studyCoach.weak_focus_areas.map((area) => (
                      <span key={area} className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="surface-subtle p-4 text-sm text-slate-600">
              Complete a quiz or upload material to unlock your guided study flow.
            </div>
          )}
        </StudyCoachPanel>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Knowledge Gaps</h3>
              <p className="text-sm text-slate-600">Weakest Bloom’s Taxonomy levels based on your quiz history.</p>
            </div>
            <Link href="/progress" className="text-sm font-semibold text-[#18181b] hover:text-[#3f3f46]">Open Progress</Link>
          </div>

          {loading ? (
            <p className="text-slate-500">Loading your progress...</p>
          ) : weakAreas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
              No quiz performance data yet. Generate your first quiz from uploaded material to populate knowledge gaps.
            </div>
          ) : (
            <div className="space-y-4">
              {weakAreas.map((area) => (
                <div key={area.level} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Level {area.level}</p>
                      <h4 className="text-lg font-bold text-slate-900">{area.name}</h4>
                      <p className="text-sm text-slate-600">{area.count} answered questions recorded at this level.</p>
                    </div>
                    <CircularProgress
                      value={area.average}
                      size={82}
                      stroke={8}
                      label="Average score"
                      caption={`${area.count} answers`}
                      progressClassName="stroke-[#c9ab3f]"
                      trackClassName="stroke-[#d4d4d8]"
                      tone="text-[#18181b]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="mb-4 text-xl font-bold text-slate-900">Recommended Next Steps</h3>
          {recommendations.length === 0 ? (
            <p className="text-slate-600">Start by uploading material and taking one quiz.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((item, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">{item}</div>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {user?.role !== 'student' && (
              <Link href="/check-difficulty" className="btn btn-outline inline-flex w-full items-center justify-center gap-2">
                <FileText className="h-4 w-4" />
                Check Question Difficulty
              </Link>
            )}
            <Link href="/start-quiz" className="btn btn-primary inline-flex w-full items-center justify-center gap-2">
              <Brain className="h-4 w-4" />
              Start Bloom’s Quiz
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  )
}

function StatCard({ label, value, accent, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${accent}`}>
        {icon}
        {label}
      </div>
      <p className="mt-6 text-4xl font-bold text-slate-950">{value}</p>
    </div>
  )
}

function StudentSignal({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.22em] text-[#fafafa]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-950">{value}</p>
    </div>
  )
}
