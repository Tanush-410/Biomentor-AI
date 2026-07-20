import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { CheckCircle2, Send, Users } from 'lucide-react'

import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson, toWebSocketBase } from '../lib/backendApi'

export default function CollaborationHubPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [createForm, setCreateForm] = useState({ title: '', agenda: '' })
  const [pollForm, setPollForm] = useState({ question: '', options: 'Yes\nNo\nNeed review' })
  const [quickCheckForm, setQuickCheckForm] = useState({ question: '', options: 'A\nB\nC\nD', correct_option: 'A', explanation: '' })
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const socketRef = useRef(null)

  const isEducator = user?.role === 'educator' || user?.role === 'admin'

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    loadSessions()
  }, [authLoading, token])

  useEffect(() => {
    if (!activeSession || !token) return undefined

    const apiBase = toWebSocketBase()
    if (!apiBase) {
      return undefined
    }
    const ws = new WebSocket(`${apiBase}/api/collaboration/ws/${activeSession.id}?token=${encodeURIComponent(token)}`)
    socketRef.current = ws

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'event' && payload.event) {
          setEvents((prev) => [...prev, payload.event])
        }
        if (payload.type === 'event_update' && payload.event) {
          setEvents((prev) => prev.map((item) => (item.id === payload.event.id ? payload.event : item)))
        }
      } catch (err) {
        console.error('Websocket parse error', err)
      }
    }

    return () => {
      ws.close()
      socketRef.current = null
    }
  }, [activeSession?.id, token])

  const loadSessions = async () => {
    try {
      const payload = await requestBackendJson('/collaboration/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSessions(payload.sessions || [])
    } catch (err) {
      setError(err.message || 'Could not load collaboration sessions')
    }
  }

  const openSession = async (sessionId) => {
    try {
      const payload = await requestBackendJson(`/collaboration/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setActiveSession(payload)
      setEvents(payload.events || [])
      loadSummary(sessionId)
    } catch (err) {
      setError(err.message || 'Could not open session')
    }
  }

  const loadSummary = async (sessionId) => {
    try {
      const payload = await requestBackendJson(`/collaboration/sessions/${sessionId}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSummary(payload)
    } catch (err) {
      console.error('Summary load error', err)
    }
  }

  const createSession = async (e) => {
    e.preventDefault()
    try {
      const payload = await requestBackendJson('/collaboration/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: createForm
      })
      setCreateForm({ title: '', agenda: '' })
      await loadSessions()
      await openSession(payload.id)
    } catch (err) {
      setError(err.message || 'Could not create session')
    }
  }

  const joinSession = async (e) => {
    e.preventDefault()
    try {
      const payload = await requestBackendJson('/collaboration/sessions/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { join_code: joinCode }
      })
      setJoinCode('')
      await loadSessions()
      await openSession(payload.session_id)
    } catch (err) {
      setError(err.message || 'Could not join session')
    }
  }

  const sendEvent = async (eventType = 'message') => {
    if (!message.trim() || !activeSession) return
    try {
      await requestBackendJson(`/collaboration/sessions/${activeSession.id}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { event_type: eventType, content: message }
      })
      setMessage('')
    } catch (err) {
      setError(err.message || 'Could not send event')
    }
  }

  const createPoll = async (e) => {
    e.preventDefault()
    if (!activeSession) return
    const options = pollForm.options.split('\n').map((option) => option.trim()).filter(Boolean)
    try {
      await requestBackendJson(`/collaboration/sessions/${activeSession.id}/polls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { question: pollForm.question, options }
      })
      setPollForm({ question: '', options: 'Yes\nNo\nNeed review' })
    } catch (err) {
      setError(err.message || 'Could not create poll')
    }
  }

  const createQuickCheck = async (e) => {
    e.preventDefault()
    if (!activeSession) return
    const options = quickCheckForm.options.split('\n').map((option) => option.trim()).filter(Boolean)
    try {
      await requestBackendJson(`/collaboration/sessions/${activeSession.id}/quick-checks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          question: quickCheckForm.question,
          options,
          correct_option: quickCheckForm.correct_option,
          explanation: quickCheckForm.explanation
        }
      })
      setQuickCheckForm({ question: '', options: 'A\nB\nC\nD', correct_option: 'A', explanation: '' })
    } catch (err) {
      setError(err.message || 'Could not create quick check')
    }
  }

  const respondToEvent = async (eventId, choice) => {
    try {
      await requestBackendJson(`/collaboration/events/${eventId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { choice }
      })
    } catch (err) {
      setError(err.message || 'Could not send response')
    }
  }

  return (
    <AppShell
      title="AI Collaboration Hub"
      eyebrow="Shared Collaboration Flow"
      description="Educators and students can launch live sessions, run polls and quick checks, ask questions, and let the AI hub surface shared biology learning gaps."
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          {isEducator ? (
            <>
              <div className="card p-6">
                <h2 className="text-xl font-bold text-slate-950">Launch live session</h2>
                <form onSubmit={createSession} className="mt-5 space-y-4">
                  <input
                    value={createForm.title}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Session title"
                    className="input"
                    required
                  />
                  <textarea
                    value={createForm.agenda}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, agenda: e.target.value }))}
                    placeholder="Agenda or shared review goal"
                    rows={4}
                    className="input"
                  />
                  <button type="submit" className="btn btn-primary">Launch session</button>
                </form>
              </div>

              {activeSession && (
                <>
                  <div className="card p-6">
                    <h2 className="text-xl font-bold text-slate-950">Live poll control</h2>
                    <form onSubmit={createPoll} className="mt-5 space-y-4">
                      <input
                        value={pollForm.question}
                        onChange={(e) => setPollForm((prev) => ({ ...prev, question: e.target.value }))}
                        placeholder="Poll question"
                        className="input"
                        required
                      />
                      <textarea
                        value={pollForm.options}
                        onChange={(e) => setPollForm((prev) => ({ ...prev, options: e.target.value }))}
                        rows={4}
                        className="input"
                      />
                      <button type="submit" className="btn btn-outline">Push Poll</button>
                    </form>
                  </div>

                  <div className="card p-6">
                    <h2 className="text-xl font-bold text-slate-950">Quick quiz control</h2>
                    <form onSubmit={createQuickCheck} className="mt-5 space-y-4">
                      <input
                        value={quickCheckForm.question}
                        onChange={(e) => setQuickCheckForm((prev) => ({ ...prev, question: e.target.value }))}
                        placeholder="Quick-check question"
                        className="input"
                        required
                      />
                      <textarea
                        value={quickCheckForm.options}
                        onChange={(e) => setQuickCheckForm((prev) => ({ ...prev, options: e.target.value }))}
                        rows={4}
                        className="input"
                      />
                      <input
                        value={quickCheckForm.correct_option}
                        onChange={(e) => setQuickCheckForm((prev) => ({ ...prev, correct_option: e.target.value }))}
                        placeholder="Correct option"
                        className="input"
                      />
                      <textarea
                        value={quickCheckForm.explanation}
                        onChange={(e) => setQuickCheckForm((prev) => ({ ...prev, explanation: e.target.value }))}
                        rows={3}
                        placeholder="Optional explanation for the answer"
                        className="input"
                      />
                      <button type="submit" className="btn btn-outline">Push Quick Check</button>
                    </form>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="card p-6">
              <h2 className="text-xl font-bold text-slate-950">Join a live session</h2>
              <form onSubmit={joinSession} className="mt-5 flex flex-col gap-4 sm:flex-row">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter join code"
                  className="input"
                  required
                />
                <button type="submit" className="btn btn-primary">Join</button>
              </form>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-xl font-bold text-slate-950">Sessions</h2>
            <div className="mt-5 space-y-4">
              {sessions.length === 0 ? (
                <p className="text-slate-600">No sessions available yet.</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => openSession(session.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      activeSession?.id === session.id ? 'border-[#f2e9c4] bg-[#e4e4e7]' : 'border-slate-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <p className="text-lg font-bold text-slate-950">{session.title}</p>
                    <p className="mt-2 text-sm text-slate-600">Join code: {session.join_code}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{session.status}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            {!activeSession ? (
              <div className="flex h-full min-h-[420px] items-center justify-center text-center text-slate-600">
                Open or join a session to start the live collaboration feed.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-950">{activeSession.title}</h2>
                    <p className="mt-2 text-sm text-slate-600">{activeSession.agenda || 'No agenda added yet.'}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f5] px-4 py-2 text-sm font-semibold text-[#18181b]">
                    <Users className="h-4 w-4" />
                    {activeSession.participants?.length || 0} participants
                  </div>
                </div>

                <div className="mt-6 h-[420px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50 p-4">
                  {events.map((event) => (
                    <div key={event.id} className={`rounded-2xl px-4 py-3 ${event.user_name === 'AI Collaboration Hub' ? 'bg-[#f4f4f5] text-slate-900' : 'bg-white text-slate-900 shadow-sm'}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{event.user_name} • {event.event_type}</p>
                      <p className="mt-2 text-sm leading-6">{event.content}</p>
                      {(event.event_type === 'poll' || event.event_type === 'quiz_prompt') && (
                        <StructuredEventCard
                          event={event}
                          isEducator={isEducator}
                          userId={user?.id}
                          onRespond={respondToEvent}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isEducator ? 'Share a prompt, poll, or instruction' : 'Ask a question or share a response'}
                    className="input"
                  />
                  <button onClick={() => sendEvent('message')} className="btn btn-outline inline-flex items-center justify-center gap-2">
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                  <button onClick={() => sendEvent('question')} className="btn btn-primary">Ask AI Hub</button>
                </div>
              </>
            )}
          </div>

          {summary && (
            <div className="card p-6">
              <h2 className="text-xl font-bold text-slate-950">Real-Time Analytics</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Shared learning gaps</p>
                  <div className="mt-3 space-y-2">
                    {(summary.shared_learning_gaps || []).map((item) => (
                      <div key={item.topic} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {item.topic}: {item.students_flagged} students flagged
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Follow-up tasks</p>
                  <div className="mt-3 space-y-2">
                    {(summary.follow_up_tasks || []).map((task, index) => (
                      <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{task}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  )
}

function StructuredEventCard({ event, isEducator, userId, onRespond }) {
  const metadata = event.metadata || {}
  const options = metadata.options || []
  const isPoll = event.event_type === 'poll'
  const responses = isPoll ? metadata.votes || {} : metadata.responses || {}
  const hasResponded = Boolean(userId && responses[userId])
  const results = metadata.results || {}

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => !hasResponded && onRespond(event.id, option)}
            disabled={hasResponded}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              hasResponded ? 'border-slate-200 bg-white text-slate-500' : 'border-slate-300 bg-white text-slate-900 hover:border-[#c9ab3f]'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span>{option}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {results[option] || 0} responses
              </span>
            </div>
          </button>
        ))}
      </div>

      {hasResponded && (
        <div className="inline-flex items-center gap-2 rounded-full bg-[#d4d4d8] px-3 py-2 text-sm font-semibold text-[#3f3f46]">
          <CheckCircle2 className="h-4 w-4" />
          Response recorded
        </div>
      )}

      {!isPoll && isEducator && metadata.answer_key && (
        <div className="rounded-xl bg-[#f4f4f5] px-4 py-3 text-sm text-slate-800">
          Correct answer: <strong>{metadata.answer_key}</strong>
          {metadata.explanation ? <span className="block mt-2">{metadata.explanation}</span> : null}
        </div>
      )}
    </div>
  )
}
