import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'

import AppShell from '../components/AppShell'
import AISpotlightBanner from '../components/AISpotlightBanner'
import { CopilotDraftCard, EducatorCopilotPanel } from '../components/EducatorCopilotPanel'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson, toWebSocketBase } from '../lib/backendApi'

export default function CommunicationHubPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [messages, setMessages] = useState([])
  const [complaints, setComplaints] = useState([])
  const [copilot, setCopilot] = useState(null)
  const [form, setForm] = useState({ subject: '', content: '', audience: 'student' })
  const [activeView, setActiveView] = useState('complaints')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
    loadCommunications()
  }, [authLoading, token, user, router])

  useEffect(() => {
    if (!token || !['educator', 'admin'].includes(user?.role)) return undefined

    const apiBase = toWebSocketBase()
    if (!apiBase) {
      return undefined
    }
    const ws = new WebSocket(`${apiBase}/api/educator/notifications/ws?token=${encodeURIComponent(token)}`)

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'complaint' && payload.complaint) {
          setComplaints((current) => [payload.complaint, ...current.filter((item) => item.id !== payload.complaint.id)])
          setActiveView('complaints')
        }
        if (payload.type === 'student_message' && payload.message) {
          setMessages((current) => [payload.message, ...current.filter((item) => item.id !== payload.message.id)])
          if (activeView !== 'complaints') {
            setActiveView('messages')
          }
        }
      } catch (wsError) {
        console.error('Notification parse error:', wsError)
      }
    }

    return () => ws.close()
  }, [token, user, activeView])

  const inboxItems = useMemo(() => {
    if (activeView === 'messages') return messages
    return complaints
  }, [activeView, messages, complaints])

  const loadCommunications = async () => {
    try {
      const [copilotPayload, messagesPayload, complaintsPayload] = await Promise.all([
        requestBackendJson('/educator/copilot/communication', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        requestBackendJson('/educator/messages', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        requestBackendJson('/educator/complaints', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])
      setCopilot(copilotPayload || null)
      setMessages(messagesPayload.messages || [])
      setComplaints(complaintsPayload.complaints || [])
    } catch (err) {
      setError(err.message || 'Could not load communications')
    }
  }

  const applyDraft = (draft) => {
    setForm({
      subject: draft.subject,
      content: draft.draft_reply,
      audience: draft.target_audience === 'classroom' ? 'classroom' : 'student'
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await requestBackendJson('/educator/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      })
      setForm({ subject: '', content: '', audience: 'student' })
      loadCommunications()
    } catch (err) {
      setError(err.message || 'Could not send communication')
    } finally {
      setSaving(false)
    }
  }

  const resolveComplaint = async (complaintId) => {
    try {
      await requestBackendJson(`/educator/complaints/${complaintId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      setComplaints((current) => current.map((item) => item.id === complaintId ? { ...item, status: 'resolved' } : item))
    } catch (err) {
      setError(err.message || 'Could not resolve complaint')
    }
  }

  return (
    <AppShell
      title="Communication Hub"
      eyebrow="Educator Workflow"
      description="Watch student difficulty signals arrive in real time, shift between complaint triage and messages, and send updates from one cleaner response workspace."
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-[18px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 break-words">{error}</div>}

      <AISpotlightBanner
        eyebrow="Communication AI Surface"
        title="Copilot Response Center"
        description="This hub is no longer just an inbox. VYDRA CORE now drafts educator responses, highlights what is urgent, and helps you decide whether a signal should stay private, become a direct reply, or turn into a class-wide update."
        highlights={['Draft-ready replies', 'Escalation guidance', 'Inbox triage signals']}
        primaryAction={{ label: 'Open Copilot Drafts', href: '#educator-copilot' }}
        secondaryAction={{ label: 'Compose Response', href: '#compose-response' }}
        status="Use the copilot first, then write or approve the response. That keeps communication faster, more consistent, and more aligned with what the student or class actually needs."
      />

      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="section-kicker text-slate-500">Live inbox</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Triage signals before they turn into learning stalls.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Keep complaints and direct messages in one place, then decide what needs a fast educator response.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-[260px] md:min-w-[260px]">
              <InboxMetric label="Complaints" value={complaints.length} accent="border-[#d4d4d8] bg-[#f4f4f5] text-[#27272a]" />
              <InboxMetric label="Messages" value={messages.length} accent="border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveView('complaints')}
              className={`btn ${activeView === 'complaints' ? 'btn-primary' : 'btn-outline'}`}
            >
              Complaint queue
            </button>
            <button
              onClick={() => setActiveView('messages')}
              className={`btn ${activeView === 'messages' ? 'btn-primary' : 'btn-outline'}`}
            >
              Message inbox
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {inboxItems.length === 0 ? (
              <div className="surface-subtle p-6 text-sm text-slate-600">
                {activeView === 'complaints'
                  ? 'No complaints received yet.'
                  : 'No student messages yet.'}
              </div>
            ) : activeView === 'complaints' ? (
              complaints.map((complaint) => (
                <div key={complaint.id} className="inbox-item overflow-hidden">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#27272a]">
                          {complaint.priority} priority
                        </span>
                        <span className="role-pill border-slate-200 bg-slate-50 text-slate-600">
                          {complaint.status}
                        </span>
                      </div>
                      <h3 className="mt-3 break-words text-lg font-bold text-slate-950">{complaint.subject}</h3>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {complaint.student_name} • {complaint.classroom_name}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{complaint.content}</p>
                    </div>
                    {complaint.status !== 'resolved' && (
                      <button onClick={() => resolveComplaint(complaint.id)} className="btn btn-outline shrink-0 self-start">
                        Mark resolved
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              messages.map((message) => (
                <div key={message.id} className="inbox-item overflow-hidden">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
                          {message.direction === 'received' ? 'Inbox' : 'Sent'}
                        </span>
                        <span className="role-pill border-slate-200 bg-slate-50 text-slate-600">
                          {message.direction === 'received'
                            ? `From ${message.sender_name || 'student'}`
                            : `To ${message.audience}`}
                        </span>
                      </div>
                      <h3 className="mt-3 break-words text-lg font-bold text-slate-950">{message.subject}</h3>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <div id="educator-copilot">
            <EducatorCopilotPanel
              title="Educator Command Center"
              summary={(copilot?.queue_summary || []).join(' ')}
            >
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-[#18181b]">Draft reason</p>
                <p className="mt-1">Each draft explains why the copilot chose that response strategy before you send anything.</p>
                <p className="mt-3 font-semibold text-[#18181b]">Escalation signal</p>
                <p className="mt-1">You can quickly see whether the issue looks private, repeatable, or likely to need class-wide clarification.</p>
              </div>
              {(copilot?.drafts || []).length === 0 ? (
                <div className="surface-subtle p-4 text-sm text-slate-600">
                  The copilot will surface draft-ready responses here as new complaints and student messages arrive.
                </div>
              ) : (
                (copilot?.drafts || []).slice(0, 2).map((draft) => (
                  <CopilotDraftCard key={draft.id} draft={draft} onUseDraft={applyDraft} data-confidence-reason={draft.confidence_reason || ''} />
                ))
              )}
            </EducatorCopilotPanel>
          </div>

          <div id="compose-response" className="card p-6">
            <p className="section-kicker text-[#18181b]">Compose update</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Send a class-wide or targeted response.</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Message subject"
                className="input"
                required
              />
              <select
                value={form.audience}
                onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
                className="input"
              >
                <option value="student">Students</option>
                <option value="classroom">Classroom</option>
                <option value="institution">Institution</option>
              </select>
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Write the personalized or class-wide message here"
                rows={8}
                className="input min-h-[220px] resize-none"
                required
              />
              <button type="submit" disabled={saving} className="btn btn-primary w-full justify-center">
                {saving ? 'Sending...' : 'Send communication'}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <p className="section-kicker text-slate-500">Response guidance</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">What to do next</h2>
            <div className="mt-5 space-y-3">
              <div className="surface-subtle p-4 text-sm leading-6 text-slate-700">
                Resolve high-priority complaints first so students see visible follow-through.
              </div>
              <div className="surface-subtle p-4 text-sm leading-6 text-slate-700">
                Use short updates for class-wide reminders, and keep individualized help inside direct replies.
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}

function InboxMetric({ label, value, accent }) {
  return (
    <div className={`rounded-[18px] border px-4 py-3 ${accent}`}>
      <p className="break-words text-[11px] font-semibold uppercase tracking-[0.18em] leading-5">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}
