import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import ClassroomShell from '../../../components/ClassroomShell'
import MeetingList from '../../../components/MeetingList'
import MeetingScheduler from '../../../components/MeetingScheduler'
import { useAuth } from '../../../context/AuthContext'
import { normalizeClassroomId, shouldApplyClassroomResponse } from '../../../lib/classroomRouteState'
import {
  createClassroomMeeting,
  getClassroom,
  getMeetingRecap,
  listClassroomMeetings,
  startClassroomMeeting
} from '../../../lib/classroomApi'

export default function ClassroomLivePage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [meetingRecaps, setMeetingRecaps] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)

  const classroomId = normalizeClassroomId(typeof router.query.id === 'string' ? router.query.id : '', classroom)
  const isTeacher = ['educator', 'admin'].includes(user?.role)

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!classroomId) return
    loadPage(classroomId)
  }, [authLoading, token, router.isReady, classroomId])

  const loadPage = async (requestedId) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, meetingsPayload] = await Promise.all([
        getClassroom(token, requestedId),
        listClassroomMeetings(token, requestedId)
      ])
      if (requestSequence.current !== requestId || !shouldApplyClassroomResponse(requestedId, classroomPayload.classroom?.id)) {
        return
      }
      setClassroom(classroomPayload.classroom)
      const nextMeetings = meetingsPayload.meetings || []
      setMeetings(nextMeetings)

      const endedMeetings = nextMeetings.filter((meeting) => meeting.status === 'ended')
      if (endedMeetings.length) {
        const recapEntries = await Promise.all(
          endedMeetings.map(async (meeting) => {
            try {
              const recapPayload = await getMeetingRecap(token, requestedId, meeting.id)
              return [meeting.id, recapPayload]
            } catch (recapError) {
              return [meeting.id, null]
            }
          })
        )
        if (requestSequence.current === requestId) {
          setMeetingRecaps(Object.fromEntries(recapEntries))
        }
      } else if (requestSequence.current === requestId) {
        setMeetingRecaps({})
      }
    } catch (err) {
      if (requestSequence.current === requestId) {
        setError(err.message || 'Could not load classroom meetings')
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
      }
    }
  }

  const handleSchedule = async (payload) => {
    setSubmitting(true)
    setError('')
    try {
      await createClassroomMeeting(token, classroomId, payload)
      await loadPage(classroomId)
    } catch (err) {
      setError(err.message || 'Could not schedule meeting.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartMeeting = async (meetingId) => {
    setError('')
    try {
      await startClassroomMeeting(token, classroomId, meetingId)
      router.push(`/classrooms/${classroomId}/live/${meetingId}/room`)
    } catch (err) {
      setError(err.message || 'Could not start meeting.')
    }
  }

  return (
    <ClassroomShell classroom={classroom} activeTab="live" isLoading={loading} error={error}>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <MeetingList
          meetings={meetings}
          role={user?.role || 'student'}
          classroomId={classroomId}
          onStartMeeting={handleStartMeeting}
        />
        {isTeacher ? (
          <MeetingScheduler onSubmit={handleSchedule} submitting={submitting} />
        ) : (
          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Student live flow</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Join directly from your classroom.</h3>
            <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600">
              <div className="surface-subtle p-4">
                Upcoming meetings appear automatically once your educator schedules them.
              </div>
              <div className="surface-subtle p-4">
                When the educator starts a meeting, the `Join Meeting` action appears in the list.
              </div>
              <div className="surface-subtle p-4">
                Browser camera and microphone access will be requested when you join the room.
              </div>
            </div>
          </div>
        )}
      </div>
      {meetings.filter((meeting) => meeting.status === 'ended').length ? (
        <div className="mt-6 space-y-4">
          {meetings
            .filter((meeting) => meeting.status === 'ended')
            .map((meeting) => {
              const recap = meetingRecaps[meeting.id]
              return (
                <section
                  key={meeting.id}
                  className="rounded-[28px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.05)]"
                >
                  <p className="section-kicker text-[#18181b]">Meeting recap</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">{meeting.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {recap?.summary || 'Summary will appear after the meeting wrap-up.'}
                  </p>
                  {(recap?.study_recap || []).length ? (
                    <div className="mt-5 rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 p-4">
                      <p className="section-kicker text-[#18181b]">Study recap</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {recap.study_recap.map((item) => (
                          <li key={`${meeting.id}-study-${item}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(recap?.action_items || []).length ? (
                    <div className="mt-5 rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 p-4">
                      <p className="section-kicker text-[#18181b]">Action items</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {recap.action_items.map((item) => (
                          <li key={`${meeting.id}-action-${item}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(recap?.unresolved_questions || []).length ? (
                    <div className="mt-5 rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 p-4">
                      <p className="section-kicker text-[#18181b]">Unresolved questions</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {recap.unresolved_questions.map((item) => (
                          <li key={`${meeting.id}-question-${item}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(recap?.next_class_moves || []).length ? (
                    <div className="mt-5 rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 p-4">
                      <p className="section-kicker text-[#18181b]">Next class moves</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {recap.next_class_moves.map((item) => (
                          <li key={`${meeting.id}-next-${item}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              )
            })}
        </div>
      ) : null}
    </ClassroomShell>
  )
}
