import React from 'react'
import Link from 'next/link'

export default function MeetingList({
  meetings = [],
  role = 'student',
  classroomId,
  onStartMeeting
}) {
  return (
    <div className="card p-6">
      <p className="section-kicker text-[#18181b]">Live meetings</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">Upcoming sessions and join state.</h3>
      <div className="mt-6 space-y-4">
        {meetings.length === 0 ? (
          <div className="surface-subtle p-5 text-sm text-slate-600">No meetings scheduled yet.</div>
        ) : (
          meetings.map((meeting) => {
            const isLive = meeting.status === 'live'
            return (
              <div key={meeting.id} className="surface-quiet p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">
                      {meeting.status}
                    </div>
                    <h4 className="mt-3 text-xl font-bold text-slate-950 break-words">{meeting.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600 whitespace-pre-wrap break-words">
                      {meeting.description || 'No description provided.'}
                    </p>
                    <p className="mt-3 text-sm text-[#3f3f46]">
                      {new Date(meeting.scheduled_start).toLocaleString()} - {new Date(meeting.scheduled_end).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {isLive ? (
                      <Link href={`/classrooms/${classroomId}/live/${meeting.id}/room`} className="btn btn-primary">
                        Join Meeting
                      </Link>
                    ) : null}
                    {role !== 'student' && meeting.status === 'scheduled' ? (
                      <button type="button" className="btn btn-outline" onClick={() => onStartMeeting?.(meeting.id)}>
                        Start Meeting
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
