import React from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, Users } from 'lucide-react'

const BANNERS = [
  'from-[#d9c25c] via-[#3f3f2a] to-[#d9c25c]',
  'from-[#c9ab3f] via-[#8a7a1f] to-[#e3ce7a]',
  'from-[#d9c25c] via-[#5a5220] to-[#dcc26a]',
  'from-[#111111] via-[#6b6320] to-[#f2e9c4]'
]

export default function ClassroomCardGrid({ classrooms = [], role = 'student' }) {
  if (!classrooms.length) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        No classrooms yet. {role === 'student' ? 'Join a classroom with an invite code to begin.' : 'Create your first classroom to start sharing materials and announcements.'}
      </div>
    )
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {classrooms.map((classroom, index) => (
        <Link
          key={classroom.id}
          href={`/classrooms/${classroom.id}/stream`}
          className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-lg shadow-zinc-200/50 transition hover:-translate-y-1 hover:border-[#c9ab3f]"
        >
          <div className={`h-36 bg-gradient-to-br ${BANNERS[index % BANNERS.length]} p-5 text-[#fafafa]`}>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-800/75">{classroom.subject || 'Classroom'}</p>
            <h3 className="mt-3 line-clamp-2 text-3xl font-bold text-zinc-950">{classroom.name}</h3>
            <p className="mt-2 text-sm text-zinc-800/85">{role === 'student' ? 'Open class stream, classwork, messages, and live sessions.' : 'Manage public updates, classwork, people, and live sessions.'}</p>
          </div>

          <div className="space-y-4 p-5">
            <p className="min-h-[3rem] text-sm leading-6 text-slate-600">
              {classroom.description || 'No description yet. Use the classroom workspace to keep study flow organized.'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="surface-subtle p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#18181b]">Learners</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Users className="h-4 w-4 text-[#18181b]" />
                  {classroom.student_count ?? 0}
                </p>
              </div>
              <div className="surface-subtle p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#18181b]">Unread</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Bell className="h-4 w-4 text-[#18181b]" />
                  {classroom.unread_notifications ?? 0}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200/80 pt-4">
              <span className="rounded-full bg-[#e4e4e7] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#3f3f46]">
                Invite {classroom.invite_code}
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#3f3f46]">
                Open classroom
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
