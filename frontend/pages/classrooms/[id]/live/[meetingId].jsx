import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function ClassroomMeetingRouteRedirect() {
  const router = useRouter()
  const classroomId = typeof router.query.id === 'string' ? router.query.id : ''
  const meetingId = typeof router.query.meetingId === 'string' ? router.query.meetingId : ''

  useEffect(() => {
    if (!router.isReady || !classroomId || !meetingId) return
    router.replace(`/classrooms/${classroomId}/live/${meetingId}/room`)
  }, [router, classroomId, meetingId])

  return null
}
