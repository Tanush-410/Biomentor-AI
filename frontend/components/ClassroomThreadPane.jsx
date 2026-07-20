import React, { useMemo, useState } from 'react'

export default function ClassroomThreadPane({
  threads = [],
  messages = [],
  activeThreadId = '',
  onSelectThread,
  onSendMessage,
  onCreateThread,
  contacts = [],
  role = 'student',
  loading = false
}) {
  const [draft, setDraft] = useState('')
  const [selectedContact, setSelectedContact] = useState(contacts[0]?.id || '')

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  )

  const handleSend = async (event) => {
    event.preventDefault()
    if (!draft.trim() || !activeThreadId) return
    await onSendMessage(draft.trim())
    setDraft('')
  }

  const handleCreateThread = async (event) => {
    event.preventDefault()
    await onCreateThread(selectedContact || undefined)
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="card flex min-h-[560px] flex-col p-4">
        <div className="border-b border-zinc-200/80 pb-4">
          <p className="section-kicker text-[#18181b]">Private contacts</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Educator-student threads</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {role === 'student'
              ? 'Only your classroom educators appear here. Chat history stays with your account.'
              : 'Choose a student to start or continue a private thread.'}
          </p>
        </div>

        {role === 'educator' && (
          <form onSubmit={handleCreateThread} className="mt-4 space-y-3">
            <select
              value={selectedContact}
              onChange={(event) => setSelectedContact(event.target.value)}
              className="input"
            >
              <option value="">Choose student</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.full_name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-outline w-full">Open thread</button>
          </form>
        )}

        <div className="mt-4 flex-1 space-y-3 overflow-auto pr-1">
          {threads.length === 0 ? (
            <div className="surface-subtle p-4 text-sm text-slate-600">
              No private threads yet.
            </div>
          ) : (
            threads.map((thread) => {
              const counterparty = role === 'student' ? thread.teacher : thread.student
              const active = thread.id === activeThreadId
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    active
                      ? 'border-[#c49a76] bg-[#e4e4e7]'
                      : 'border-zinc-200 bg-[#fafafa] hover:border-[#f2e9c4]'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-950">{counterparty?.full_name || 'Conversation'}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#18181b]">{counterparty?.role || 'Thread'}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {thread.last_message_at ? new Date(thread.last_message_at).toLocaleString() : 'No activity yet'}
                  </p>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="card flex min-h-[560px] flex-col p-0">
        <div className="border-b border-zinc-200/80 px-6 py-5">
          <p className="text-sm font-semibold text-slate-950">
            {activeThread
              ? `${role === 'student' ? activeThread.teacher?.full_name : activeThread.student?.full_name || 'Selected thread'}`
              : 'Choose a thread'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Message history stays available after login and remains private to the educator-student pair.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-auto px-6 py-5">
          {loading ? (
            <div className="text-sm text-slate-600">Loading messages...</div>
          ) : !activeThreadId ? (
            <div className="surface-subtle p-5 text-sm text-slate-600">Select a thread to see the conversation.</div>
          ) : messages.length === 0 ? (
            <div className="surface-subtle p-5 text-sm text-slate-600">No messages yet. Start the conversation.</div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-[24px] px-4 py-3 ${
                  message.sender?.role === role
                    ? 'ml-auto bg-[#c9ab3f] text-[#fafafa]'
                    : 'bg-[#e4e4e7] text-slate-900'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-75">{message.sender?.name}</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                <p className="mt-2 text-[11px] opacity-70">{new Date(message.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-zinc-200/80 px-5 py-4">
          <div className="flex gap-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="input min-h-[100px]"
              placeholder={activeThreadId ? 'Write a private message...' : 'Select a thread first'}
              disabled={!activeThreadId}
            />
            <button type="submit" className="btn btn-primary self-end" disabled={!activeThreadId || !draft.trim()}>
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
