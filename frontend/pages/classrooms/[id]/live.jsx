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
  listClassroomMeetings,
  startClassroomMeeting
} from '../../../lib/classroomApi'

export default function ClassroomLivePage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [meetings, setMeetings] = useState([])
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
      setMeetings(meetingsPayload.meetings || [])
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
            <p className="section-kicker text-[#8a5a36]">Student live flow</p>
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
    </ClassroomShell>
  )
}
