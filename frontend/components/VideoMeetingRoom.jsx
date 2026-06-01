import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Camera, Mic, PhoneOff, Video } from 'lucide-react'

import MeetingAssistantPanel from './MeetingAssistantPanel'
import { useWebRTCMeeting } from '../hooks/useWebRTCMeeting'
import { getMeetingAssistantSnapshot, postMeetingEvent, postMeetingTranscript } from '../lib/classroomApi'
import { createMeetingTranscriptClient } from '../lib/meetingTranscriptClient'

function VideoTile({ title, stream, muted = false }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null
    }
  }, [stream])

  return (
    <div className="surface-quiet overflow-hidden rounded-[28px] border border-[rgba(138,90,54,0.18)]">
      <div className="aspect-video bg-[#2f2016]">
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900">
        <span>{title}</span>
        <Video className="h-4 w-4 text-[#8a5a36]" />
      </div>
    </div>
  )
}

export default function VideoMeetingRoom({ classroomId, meeting, token, user, isTeacher = false, onTeacherEnd }) {
  const {
    connectionState,
    error,
    localStream,
    remoteParticipants,
    participants,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    leaveMeeting,
    endMeeting
  } = useWebRTCMeeting({
    meetingId: meeting?.id,
    token,
    user,
    enabled: Boolean(meeting?.id)
  })
  const [assistantSnapshot, setAssistantSnapshot] = useState(null)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const transcriptClientRef = useRef(null)
  const refreshTimeoutRef = useRef(null)

  const participantNames = new Map(
    (participants || []).map((participant) => [participant.user_id, participant.full_name || participant.user_id])
  )

  const refreshAssistantSnapshot = useCallback(async () => {
    if (!isTeacher || !meeting?.id || !token) return
    setAssistantLoading(true)
    try {
      const payload = await getMeetingAssistantSnapshot(token, classroomId, meeting.id)
      setAssistantSnapshot(payload)
      setAssistantError('')
    } catch (snapshotError) {
      setAssistantError(snapshotError.message || 'Could not load the AI meeting assistant.')
    } finally {
      setAssistantLoading(false)
    }
  }, [classroomId, isTeacher, meeting?.id, token])

  const transcriptClient = useMemo(
    () =>
      createMeetingTranscriptClient({
        onSnippet: async (content) => {
          if (!meeting?.id || !token || !content.trim()) return
          await postMeetingTranscript(token, classroomId, meeting.id, {
            speaker_role: user?.role || 'educator',
            speaker_name: user?.full_name,
            content
          })
          await refreshAssistantSnapshot()
        }
      }),
    [classroomId, meeting?.id, refreshAssistantSnapshot, token, user?.full_name, user?.role]
  )

  useEffect(() => {
    if (!isTeacher || !meeting?.id) return undefined
    refreshAssistantSnapshot()
    refreshTimeoutRef.current = window.setInterval(() => {
      refreshAssistantSnapshot()
    }, 12000)

    if (transcriptClient.isSupported) {
      transcriptClientRef.current = transcriptClient
      transcriptClientRef.current.start()
    }

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearInterval(refreshTimeoutRef.current)
      }
      transcriptClientRef.current?.stop?.()
      transcriptClientRef.current = null
    }
  }, [isTeacher, meeting?.id, refreshAssistantSnapshot, transcriptClient])

  const handleTeacherEnd = async () => {
    endMeeting()
    await onTeacherEnd?.()
  }

  const handleFlagDoubt = async () => {
    if (!meeting?.id || !token) return
    await postMeetingEvent(token, classroomId, meeting.id, {
      event_type: 'doubt_flag',
      payload: {
        question: 'Educator flagged an unresolved doubt for follow-up.'
      }
    })
    await refreshAssistantSnapshot()
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
      {assistantError ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">{assistantError}</div> : null}

      <div className={`grid gap-5 ${isTeacher ? '2xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <VideoTile title={`${user?.full_name || 'You'} (You)`} stream={localStream} muted />
            {remoteParticipants.length === 0 ? (
              <div className="surface-subtle flex aspect-video items-center justify-center rounded-[28px] border border-dashed border-[rgba(138,90,54,0.25)] text-sm text-slate-600">
                Waiting for other participants to join...
              </div>
            ) : (
              remoteParticipants.map((participant) => (
                <VideoTile
                  key={participant.userId}
                  title={participantNames.get(participant.userId) || participant.userId}
                  stream={participant.stream}
                />
              ))
            )}
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn btn-outline" onClick={toggleMute}>
                <Mic className="h-4 w-4" />
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button type="button" className="btn btn-outline" onClick={toggleCamera}>
                <Camera className="h-4 w-4" />
                {isCameraOff ? 'Camera On' : 'Camera Off'}
              </button>
              {isTeacher ? (
                <button type="button" className="btn btn-outline" onClick={handleFlagDoubt}>
                  <AlertCircle className="h-4 w-4" />
                  Flag Doubt
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/classrooms/${classroomId}/live`} className="btn btn-outline" onClick={leaveMeeting}>
                Leave
              </Link>
              {isTeacher ? (
                <button type="button" className="btn btn-primary" onClick={handleTeacherEnd}>
                  <PhoneOff className="h-4 w-4" />
                  End Meeting
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {isTeacher ? (
          <MeetingAssistantPanel
            snapshot={assistantSnapshot}
            isLoading={assistantLoading}
            transcriptSupported={transcriptClient.isSupported}
          />
        ) : null}
      </div>
    </div>
  )
}
