import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, Brain, CalendarDays, ClipboardList, FileText, MessageSquare, Sparkles, Users } from 'lucide-react'
import { useRouter } from 'next/router'

import VideoMeetingRoom from '../../../../../components/VideoMeetingRoom'
import { useAuth } from '../../../../../context/AuthContext'
import { normalizeClassroomId, shouldApplyClassroomResponse } from '../../../../../lib/classroomRouteState'
import { endClassroomMeeting, getClassroom, getClassroomMeeting } from '../../../../../lib/classroomApi'

function formatSchedule(meeting) {
  if (!meeting?.scheduled_start) return 'Live now'
  const start = new Date(meeting.scheduled_start).toLocaleString()
  const end = meeting.scheduled_end ? new Date(meeting.scheduled_end).toLocaleTimeString() : null
  return end ? `${start} - ${end}` : start
}

export default function DedicatedMeetingRoomPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)

  const classroomId = normalizeClassroomId(typeof router.query.id === 'string' ? router.query.id : '', classroom)
  const meetingId = typeof router.query.meetingId === 'string' ? router.query.meetingId : ''
  const isTeacher = ['educator', 'admin'].includes(user?.role)

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!classroomId || !meetingId) return
    loadPage(classroomId, meetingId)
  }, [authLoading, token, router.isReady, classroomId, meetingId])

  const loadPage = async (requestedClassroomId, requestedMeetingId) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, meetingPayload] = await Promise.all([
        getClassroom(token, requestedClassroomId),
        getClassroomMeeting(token, requestedClassroomId, requestedMeetingId)
      ])
      if (requestSequence.current !== requestId || !shouldApplyClassroomResponse(requestedClassroomId, classroomPayload.classroom?.id)) {
        return
      }
      setClassroom(classroomPayload.classroom)
      setMeeting(meetingPayload.meeting)
      if (!meetingPayload.can_join && user?.role === 'student') {
        setError('This meeting is not live yet.')
      }
    } catch (err) {
      if (requestSequence.current === requestId) {
        setError(err.message || 'Could not open the meeting room.')
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
      }
    }
  }

  const handleTeacherEnd = async () => {
    if (!meetingId) return
    await endClassroomMeeting(token, classroomId, meetingId)
    router.push(`/classrooms/${classroomId}/live`)
  }

  const quickActions = useMemo(() => {
    const sharedActions = [
      {
        label: 'Open Classwork',
        description: 'Jump back to assigned material and follow-up resources.',
        href: `/classrooms/${classroomId}/classwork`,
        icon: FileText
      },
      {
        label: 'Open Messages',
        description: 'Continue the conversation privately after class.',
        href: `/classrooms/${classroomId}/messages`,
        icon: MessageSquare
      }
    ]

    if (isTeacher) {
      return [
        ...sharedActions,
        {
          label: 'Create Follow-up Quiz',
          description: 'Turn this session into a classroom assessment next.',
          href: '/educator/quiz-maker',
          icon: Brain
        }
      ]
    }

    return [
      ...sharedActions,
      {
        label: 'View People',
        description: 'See everyone in this class and who led the session.',
        href: `/classrooms/${classroomId}/people`,
        icon: Users
      }
    ]
  }, [classroomId, isTeacher])

  if (loading && !classroom) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_42%,#e4e4e7_100%)] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-[1600px] rounded-[32px] border border-[rgba(0,0,0,0.14)] bg-[rgba(255,255,255,0.94)] p-10 shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
          <p className="section-kicker text-[#18181b]">Meeting room</p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">Loading dedicated room...</h1>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_42%,#e4e4e7_100%)] px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="rounded-[32px] border border-[rgba(0,0,0,0.14)] bg-[rgba(255,255,255,0.94)] shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 border-b border-[rgba(0,0,0,0.12)] px-6 py-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Link href={`/classrooms/${classroomId}/live`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#18181b] transition hover:text-[#3f3f46]">
                <ArrowLeft className="h-4 w-4" />
                Back to Live Lobby
              </Link>
              <div>
                <p className="section-kicker text-[#18181b]">Dedicated meeting room</p>
                <h1 className="mt-2 text-4xl font-bold text-slate-950">{meeting?.title || 'Class Meeting'}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {meeting?.description || 'Meet away from the classroom dashboard so everyone can focus on the live session.'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Classroom</p>
                <p className="mt-3 text-base font-semibold text-slate-950">{classroom?.name || 'Classroom'}</p>
              </div>
              <div className="rounded-[24px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Schedule</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">{formatSchedule(meeting)}</p>
              </div>
              <div className="rounded-[24px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Status</p>
                <p className="mt-3 text-base font-semibold capitalize text-slate-950">{meeting?.status || 'connecting'}</p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="px-6 pt-6">
              <div className="rounded-[20px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>
            </div>
          ) : null}

          <div className="grid gap-6 px-6 py-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              {meeting ? (
                <VideoMeetingRoom
                  classroomId={classroomId}
                  meeting={meeting}
                  token={token}
                  user={user}
                  isTeacher={isTeacher}
                  onTeacherEnd={handleTeacherEnd}
                />
              ) : null}
            </div>

            <aside className="space-y-5">
              <div className="rounded-[28px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#e4e4e7] p-3 text-[#18181b]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="section-kicker text-[#18181b]">AI meeting assistant</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-950">Ready for notes, recaps, and follow-up study tools.</h2>
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                  <div className="rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
                    <p className="font-semibold text-slate-950">Live Notes</p>
                    <p className="mt-2">This dedicated panel is where transcript-powered notes and summaries can slot in next.</p>
                  </div>
                  <div className="rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
                    <p className="font-semibold text-slate-950">Action Items</p>
                    <p className="mt-2">Capture post-class tasks, revision pointers, and key doubts without cluttering the video stage.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#e4e4e7] p-3 text-[#18181b]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="section-kicker text-[#18181b]">Helpful tools</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-950">Keep the class moving while the meeting is live.</h2>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        className="flex items-start gap-3 rounded-[22px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4 transition hover:border-[#c9ab3f] hover:bg-white"
                      >
                        <div className="rounded-2xl bg-[#e4e4e7] p-3 text-[#18181b]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-950">{action.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#e4e4e7] p-3 text-[#18181b]">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="section-kicker text-[#18181b]">Session context</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-950">What this meeting is anchored to.</h2>
                  </div>
                </div>
                <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                  <p className="rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
                    <CalendarDays className="mb-2 h-4 w-4 text-[#18181b]" />
                    {formatSchedule(meeting)}
                  </p>
                  <p className="rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
                    <Users className="mb-2 h-4 w-4 text-[#18181b]" />
                    Educators and students can stay in the room while hopping back to classwork and messages through the tool panel.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
