import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Camera, Mic, PhoneOff, Video } from 'lucide-react'

import MeetingAssistantPanel from './MeetingAssistantPanel'
import AISpotlightBanner from './AISpotlightBanner'
import { useWebRTCMeeting } from '../hooks/useWebRTCMeeting'
import { getMeetingAssistantSnapshot, postMeetingAudioTranscript, postMeetingEvent, postMeetingTranscript } from '../lib/classroomApi'
import { isHostedFrontend } from '../lib/backendApi'
import { createMeetingAudioTranscriber } from '../lib/meetingAudioTranscriber'
import { createMeetingTranscriptClient } from '../lib/meetingTranscriptClient'

function VideoTile({ title, stream, muted = false }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.muted = muted
    ref.current.srcObject = stream || null
    ref.current
      .play?.()
      .catch(async () => {
        if (!ref.current || muted) return
        ref.current.muted = true
        try {
          await ref.current.play?.()
          ref.current.muted = false
        } catch (_error) {
          // Leave the tile visible even if autoplay policy blocks the first remote-audio attempt.
        }
      })
  }, [muted, stream])

  return (
    <div className="surface-quiet overflow-hidden rounded-[28px] border border-[rgba(0,0,0,0.18)]">
      <div className="aspect-video bg-[#d9c25c]">
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900">
        <span>{title}</span>
        <Video className="h-4 w-4 text-[#18181b]" />
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
  const audioTranscriberRef = useRef(null)
  const refreshTimeoutRef = useRef(null)
  const turnUrlsConfigured = Boolean(process.env.NEXT_PUBLIC_TURN_URLS || process.env.NEXT_PUBLIC_TURN_URL)
  const turnCredentialConfigured = Boolean(process.env.NEXT_PUBLIC_TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_PASSWORD)
  const turnRelayConfigured = Boolean(
    turnUrlsConfigured
      && process.env.NEXT_PUBLIC_TURN_USERNAME
      && turnCredentialConfigured
  )
  const relayAdvisory =
    isHostedFrontend() && !turnRelayConfigured
      ? 'TURN relay is not configured for hosted classrooms yet, so remote audio/video can fail on stricter networks. Add TURN relay credentials for production-grade meeting reliability.'
      : ''

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

  const audioTranscriber = useMemo(
    () =>
      createMeetingAudioTranscriber({
        onChunk: async (blob) => {
          if (!meeting?.id || !token || !blob?.size) return
          const payload = await postMeetingAudioTranscript(token, classroomId, meeting.id, blob)
          if (payload?.transcript_created) {
            await refreshAssistantSnapshot()
          }
        }
      }),
    [classroomId, meeting?.id, refreshAssistantSnapshot, token]
  )

  useEffect(() => {
    if (!isTeacher || !meeting?.id) return undefined
    refreshAssistantSnapshot()
    refreshTimeoutRef.current = window.setInterval(() => {
      refreshAssistantSnapshot()
    }, 12000)

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearInterval(refreshTimeoutRef.current)
      }
    }
  }, [isTeacher, meeting?.id, refreshAssistantSnapshot])

  useEffect(() => {
    if (!isTeacher || !meeting?.id) return undefined

    if (audioTranscriber.isSupported) {
      audioTranscriberRef.current = audioTranscriber
      audioTranscriberRef.current.start([localStream, ...remoteParticipants.map((participant) => participant.stream)]).catch(() => {})
    }
    if (transcriptClient.isSupported) {
      transcriptClientRef.current = transcriptClient
      transcriptClientRef.current.start()
    }

    return () => {
      transcriptClientRef.current?.stop?.()
      transcriptClientRef.current = null
      audioTranscriberRef.current?.stop?.()
      audioTranscriberRef.current = null
    }
  }, [audioTranscriber, isTeacher, localStream, meeting?.id, transcriptClient])

  useEffect(() => {
    if (!audioTranscriberRef.current) return
    audioTranscriberRef.current
      .updateStreams([localStream, ...remoteParticipants.map((participant) => participant.stream)])
      .catch(() => {})
  }, [localStream, remoteParticipants])

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
      {error ? <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div> : null}
      {relayAdvisory ? <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-800">{relayAdvisory}</div> : null}
      {assistantError ? <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-800">{assistantError}</div> : null}

      <AISpotlightBanner
        eyebrow="Live AI Surface"
        title="AI Teaching Room"
        description="The meeting room is now a dedicated teaching surface: run the live session, watch who is present, and let the meeting assistant turn discussion into educator moves, doubts, and follow-up study assets."
        highlights={['Live educator copilot', 'Doubt flags', 'Post-meeting recap']}
        primaryAction={isTeacher ? { label: 'Open Meeting Copilot', href: '#meeting-copilot' } : undefined}
        secondaryAction={{ label: 'Return to Live Lobby', href: `/classrooms/${classroomId}/live` }}
        status="Use the room for the session itself. Use the copilot to capture what happened and what the class should do next."
      />

      {isTeacher ? (
        <div id="meeting-copilot" className="card p-6">
          <p className="section-kicker text-[#18181b]">Meeting Copilot</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Live educator guidance during the session.</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            VYDRA CORE is reading transcript snippets and your explicit meeting flags to suggest what to reteach, what students are still unsure about, and what should happen after the room ends.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="surface-subtle p-4 text-sm text-slate-700">Use <strong>Flag Doubt</strong> when a concept remains unresolved.</div>
            <div className="surface-subtle p-4 text-sm text-slate-700">The educator copilot refreshes automatically while the room stays open.</div>
            <div className="surface-subtle p-4 text-sm text-slate-700">Ended meetings publish a cleaner student-safe recap back in the class live page.</div>
          </div>
        </div>
      ) : null}

      <div className={`grid gap-5 ${isTeacher ? '2xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <VideoTile title={`${user?.full_name || 'You'} (You)`} stream={localStream} muted />
            {remoteParticipants.length === 0 ? (
              <div className="surface-subtle flex aspect-video items-center justify-center rounded-[28px] border border-dashed border-[rgba(0,0,0,0.25)] text-sm text-slate-600">
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
            transcriptSupported={transcriptClient.isSupported || audioTranscriber.isSupported}
          />
        ) : null}
      </div>
    </div>
  )
}
