import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import ClassroomLivePanel from '../../../components/ClassroomLivePanel'
import ClassroomShell from '../../../components/ClassroomShell'
import { useAuth } from '../../../context/AuthContext'
import { normalizeClassroomId, shouldApplyClassroomResponse } from '../../../lib/classroomRouteState'
import { getClassroom, getClassroomLive, scheduleClassroomLive, startClassroomLive } from '../../../lib/classroomApi'

export default function ClassroomLivePage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)
  const classroomId = normalizeClassroomId(typeof router.query.id === 'string' ? router.query.id : '', classroom)

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
      const [classroomPayload, livePayload] = await Promise.all([
        getClassroom(token, requestedId),
        getClassroomLive(token, requestedId)
      ])
      if (requestSequence.current !== requestId || !shouldApplyClassroomResponse(requestedId, classroomPayload.classroom?.id)) {
        return
      }
      setClassroom(classroomPayload.classroom)
      setSessions(livePayload.sessions || [])
    } catch (err) {
      if (requestSequence.current === requestId) {
        setError(err.message || 'Could not load live sessions')
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
      }
    }
  }

  const handleSchedule = async (payload) => {
    setError('')
    try {
      await scheduleClassroomLive(token, classroomId, payload)
      await loadPage(classroomId)
    } catch (err) {
      setError(err.message || 'Could not schedule live session')
    }
  }

  const handleStartNow = async (payload) => {
    setError('')
    try {
      await startClassroomLive(token, classroomId, payload)
      await loadPage(classroomId)
    } catch (err) {
      setError(err.message || 'Could not start live session')
    }
  }

  return (
    <ClassroomShell classroom={classroom} activeTab="live" isLoading={loading} error={error}>
      <ClassroomLivePanel
        sessions={sessions}
        role={user?.role || 'student'}
        onSchedule={handleSchedule}
        onStartNow={handleStartNow}
      />
    </ClassroomShell>
  )
}
