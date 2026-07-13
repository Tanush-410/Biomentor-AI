import React, { useState } from 'react'

export default function MeetingScheduler({ onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduled_start: '',
    duration_minutes: 60
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const start = new Date(form.scheduled_start)
    const end = new Date(start.getTime() + Number(form.duration_minutes || 60) * 60 * 1000)
    await onSubmit({
      title: form.title,
      description: form.description,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString()
    })
    setForm({
      title: '',
      description: '',
      scheduled_start: '',
      duration_minutes: 60
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <p className="section-kicker text-[#18181b]">Schedule meeting</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">Plan a classroom video session.</h3>
      <div className="mt-5 space-y-4">
        <input
          className="input"
          placeholder="Meeting title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          required
        />
        <textarea
          className="input min-h-[120px]"
          placeholder="Description or agenda"
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        />
        <input
          type="datetime-local"
          className="input"
          value={form.scheduled_start}
          onChange={(event) => setForm((current) => ({ ...current, scheduled_start: event.target.value }))}
          required
        />
        <input
          type="number"
          min="15"
          max="240"
          className="input"
          value={form.duration_minutes}
          onChange={(event) => setForm((current) => ({ ...current, duration_minutes: event.target.value }))}
          required
        />
        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? 'Scheduling...' : 'Schedule Meeting'}
        </button>
      </div>
    </form>
  )
}
