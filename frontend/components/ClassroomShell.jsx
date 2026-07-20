import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Bell, CalendarDays, Copy, Users } from 'lucide-react'

import AppShell from './AppShell'
import { getClassroomBasePath } from '../lib/classroomRouteState'

const TABS = [
  { key: 'stream', label: 'Stream' },
  { key: 'classwork', label: 'Classwork' },
  { key: 'people', label: 'People' },
  { key: 'messages', label: 'Messages' },
  { key: 'live', label: 'Live' }
]

export default function ClassroomShell({
  classroom,
  activeTab,
  children,
  actions = null,
  isLoading = false,
  error = ''
}) {
  const router = useRouter()
  const routeClassroomId = typeof router.query.id === 'string' ? router.query.id : ''
  const basePath = getClassroomBasePath(routeClassroomId, classroom)

  const copyInviteCode = async () => {
    if (!classroom?.invite_code || typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(classroom.invite_code)
  }

  return (
    <AppShell
      title={classroom?.name || 'Classroom'}
      eyebrow={classroom ? `${classroom.subject || 'Classroom'} workspace` : 'Classroom'}
      description={classroom?.description || 'Work through announcements, classwork, people, private support, and live sessions in one organized classroom flow.'}
      contentClassName="space-y-6"
      actions={actions}
    >
      <section className="card overflow-hidden">
        <div className="border-b border-zinc-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.94),rgba(228,228,231,0.84))] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-kicker text-zinc-500">Classroom hub</p>
              <h2 className="mt-2 text-4xl font-bold text-zinc-950">{classroom?.name || 'Loading classroom'}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
                {classroom?.description || 'Class-wide updates, classwork, direct educator contact, and live session access live here.'}
              </p>
            </div>

            {classroom && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="surface-subtle min-w-[160px] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">People</p>
                  <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-zinc-950">
                    <Users className="h-4 w-4 text-zinc-700" />
                    {classroom.student_count ?? 0} learners
                  </p>
                </div>
                <div className="surface-subtle min-w-[160px] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Notifications</p>
                  <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-zinc-950">
                    <Bell className="h-4 w-4 text-zinc-700" />
                    {classroom.unread_notifications ?? 0} unread
                  </p>
                </div>
                <div className="surface-subtle min-w-[160px] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Invite</p>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
                  >
                    {classroom.invite_code || 'Unavailable'}
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {classroom?.next_live_session && (
            <div className="mt-5 inline-flex flex-wrap items-center gap-3 rounded-full border border-zinc-200 bg-white/90 px-4 py-2 text-sm text-zinc-700">
              <CalendarDays className="h-4 w-4" />
              Next live: {classroom.next_live_session.title}
              {classroom.next_live_session.scheduled_for ? ` • ${new Date(classroom.next_live_session.scheduled_for).toLocaleString()}` : ''}
            </div>
          )}
        </div>

        <div className="overflow-x-auto px-3 py-3 sm:px-5">
          <div className="flex min-w-max gap-2">
            {TABS.map((tab) => {
              const href = `${basePath}/${tab.key}`
              const active = activeTab === tab.key || (tab.key === 'stream' && router.pathname === '/classrooms/[id]')
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-zinc-950 text-[#d9c25c] shadow-md shadow-black/10'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-black'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {error && <div className="rounded-[18px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}
      {isLoading ? <div className="card p-6 text-zinc-600">Loading classroom workspace...</div> : children}
    </AppShell>
  )
}
