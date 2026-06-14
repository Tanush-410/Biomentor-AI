import React from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, Users } from 'lucide-react'

const BANNERS = [
  'from-[#6e5036] via-[#8c6540] to-[#b18863]',
  'from-[#5f4028] via-[#836144] to-[#d6b393]',
  'from-[#82623f] via-[#9c7347] to-[#e0c4a4]',
  'from-[#4f3723] via-[#725036] to-[#b98a60]'
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
          className="group overflow-hidden rounded-[28px] border border-stone-200 bg-[rgba(255,251,247,0.96)] shadow-lg shadow-stone-200/50 transition hover:-translate-y-1 hover:border-[#c8a789]"
        >
          <div className={`h-36 bg-gradient-to-br ${BANNERS[index % BANNERS.length]} p-5 text-[#fff7ef]`}>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">{classroom.subject || 'Classroom'}</p>
            <h3 className="mt-3 line-clamp-2 text-3xl font-bold text-white">{classroom.name}</h3>
            <p className="mt-2 text-sm text-white/85">{role === 'student' ? 'Open class stream, classwork, messages, and live sessions.' : 'Manage public updates, classwork, people, and live sessions.'}</p>
          </div>

          <div className="space-y-4 p-5">
            <p className="min-h-[3rem] text-sm leading-6 text-slate-600">
              {classroom.description || 'No description yet. Use the classroom workspace to keep study flow organized.'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="surface-subtle p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a5a36]">Learners</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Users className="h-4 w-4 text-[#8a5a36]" />
                  {classroom.student_count ?? 0}
                </p>
              </div>
              <div className="surface-subtle p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a5a36]">Unread</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Bell className="h-4 w-4 text-[#8a5a36]" />
                  {classroom.unread_notifications ?? 0}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-stone-200/80 pt-4">
              <span className="rounded-full bg-[#f5ebdf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#6d472d]">
                Invite {classroom.invite_code}
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#6d472d]">
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
