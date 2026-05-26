import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Camera, Mic, PhoneOff, Video } from 'lucide-react'

import { useWebRTCMeeting } from '../hooks/useWebRTCMeeting'

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

  const participantNames = new Map(
    (participants || []).map((participant) => [participant.user_id, participant.full_name || participant.user_id])
  )

  const handleTeacherEnd = async () => {
    endMeeting()
    await onTeacherEnd?.()
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}

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
  )
}
