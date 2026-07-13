import React, { useState } from 'react'
import { CalendarDays, ExternalLink, Radio } from 'lucide-react'

export default function ClassroomLivePanel({
  sessions = [],
  role = 'student',
  onSchedule,
  onStartNow
}) {
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    agenda: '',
    meeting_provider: 'google-meet',
    meeting_url: '',
    scheduled_for: ''
  })
  const [startForm, setStartForm] = useState({
    title: '',
    agenda: '',
    meeting_url: ''
  })

  const handleSchedule = async (event) => {
    event.preventDefault()
    await onSchedule(scheduleForm)
    setScheduleForm({
      title: '',
      agenda: '',
      meeting_provider: 'google-meet',
      meeting_url: '',
      scheduled_for: ''
    })
  }

  const handleStart = async (event) => {
    event.preventDefault()
    await onStartNow(startForm)
    setStartForm({
      title: '',
      agenda: '',
      meeting_url: ''
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="card p-6">
        <p className="section-kicker text-[#18181b]">Live sessions</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">Scheduled calls and active meeting links.</h3>
        <div className="mt-6 space-y-4">
          {sessions.length === 0 ? (
            <div className="surface-subtle p-5 text-sm text-slate-600">
              No live sessions yet.
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="surface-quiet p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">
                      {session.status}
                    </div>
                    <h4 className="mt-3 text-xl font-bold text-slate-950">{session.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{session.agenda || 'No agenda provided yet.'}</p>
                    {session.scheduled_for && (
                      <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#3f3f46]">
                        <CalendarDays className="h-4 w-4" />
                        {new Date(session.scheduled_for).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {session.meeting_url ? (
                    <a href={session.meeting_url} target="_blank" rel="noreferrer" className="btn btn-primary">
                      Join call
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <div className="rounded-full bg-[#e4e4e7] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3f3f46]">
                      Link pending
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {role === 'student' ? (
        <div className="card p-6">
          <p className="section-kicker text-[#18181b]">Attendance flow</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">You’ll be notified when a session is scheduled or started.</h3>
          <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600">
            <div className="surface-subtle p-4">
              Public stream posts announce live sessions to the whole classroom.
            </div>
            <div className="surface-subtle p-4">
              Your classroom notification count updates when an educator schedules or starts a call.
            </div>
            <div className="surface-subtle p-4">
              Use the join link from this page to open the external meeting room.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleSchedule} className="card p-6">
            <p className="section-kicker text-[#18181b]">Schedule</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Plan a class video session.</h3>
            <div className="mt-5 space-y-4">
              <input value={scheduleForm.title} onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))} className="input" placeholder="Session title" required />
              <textarea value={scheduleForm.agenda} onChange={(event) => setScheduleForm((current) => ({ ...current, agenda: event.target.value }))} className="input min-h-[120px]" placeholder="Agenda or pre-read notes" />
              <select value={scheduleForm.meeting_provider} onChange={(event) => setScheduleForm((current) => ({ ...current, meeting_provider: event.target.value }))} className="input">
                <option value="google-meet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="teams">Microsoft Teams</option>
                <option value="external">External link</option>
              </select>
              <input value={scheduleForm.meeting_url} onChange={(event) => setScheduleForm((current) => ({ ...current, meeting_url: event.target.value }))} className="input" placeholder="Meeting URL" required />
              <input value={scheduleForm.scheduled_for} onChange={(event) => setScheduleForm((current) => ({ ...current, scheduled_for: event.target.value }))} type="datetime-local" className="input" required />
              <button type="submit" className="btn btn-outline w-full">Schedule session</button>
            </div>
          </form>

          <form onSubmit={handleStart} className="card p-6">
            <p className="section-kicker text-[#18181b]">Go live</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Start a session right now.</h3>
            <div className="mt-5 space-y-4">
              <input value={startForm.title} onChange={(event) => setStartForm((current) => ({ ...current, title: event.target.value }))} className="input" placeholder="Now-live title" required />
              <textarea value={startForm.agenda} onChange={(event) => setStartForm((current) => ({ ...current, agenda: event.target.value }))} className="input min-h-[110px]" placeholder="Quick note about the live discussion" />
              <input value={startForm.meeting_url} onChange={(event) => setStartForm((current) => ({ ...current, meeting_url: event.target.value }))} className="input" placeholder="Meeting URL" required />
              <button type="submit" className="btn btn-primary w-full">
                Start now
                <Radio className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
