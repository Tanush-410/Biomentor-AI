import React, { useState } from 'react'

export default function ClassroomStreamComposer({ onSubmit, isSubmitting = false }) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    post_type: 'announcement',
    is_pinned: false
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSubmit(form)
    setForm({
      title: '',
      content: '',
      post_type: 'announcement',
      is_pinned: false
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <p className="section-kicker text-[#18181b]">Public post</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">Share something with the whole class.</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
        <input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          className="input"
          placeholder="Announcement title"
        />
        <select
          value={form.post_type}
          onChange={(event) => setForm((current) => ({ ...current, post_type: event.target.value }))}
          className="input"
        >
          <option value="announcement">Announcement</option>
          <option value="material_share">Material share</option>
          <option value="reminder">Reminder</option>
        </select>
      </div>
      <textarea
        value={form.content}
        onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
        className="input mt-4 min-h-[150px]"
        placeholder="Post a public update, reminder, or class message."
        required
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(event) => setForm((current) => ({ ...current, is_pinned: event.target.checked }))}
          />
          Pin this to the top of the class stream
        </label>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Posting...' : 'Post to stream'}
        </button>
      </div>
    </form>
  )
}
