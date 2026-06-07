import { useEffect, useRef, useState } from 'react'

import { createMeetingSignalingClient } from '../lib/meetingSignalingClient'

const getIceServers = () => {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }]
  if (process.env.NEXT_PUBLIC_TURN_URL && process.env.NEXT_PUBLIC_TURN_USERNAME && process.env.NEXT_PUBLIC_TURN_CREDENTIAL) {
    servers.push({
      urls: process.env.NEXT_PUBLIC_TURN_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    })
  }
  return servers
}

export function useWebRTCMeeting({ meetingId, token, user, enabled = true }) {
  const [connectionState, setConnectionState] = useState('idle')
  const [error, setError] = useState('')
  const [localStream, setLocalStream] = useState(null)
  const [remoteParticipants, setRemoteParticipants] = useState([])
  const [participants, setParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  const signalingRef = useRef(null)
  const peerConnectionsRef = useRef(new Map())
  const pendingIceCandidatesRef = useRef(new Map())
  const remoteStreamsRef = useRef(new Map())
  const localStreamRef = useRef(null)

  useEffect(() => {
    if (!enabled || !meetingId || !token || !user?.id) return undefined

    let disposed = false

    const queueIceCandidate = (targetUserId, candidatePayload) => {
      const current = pendingIceCandidatesRef.current.get(targetUserId) || []
      current.push(candidatePayload)
      pendingIceCandidatesRef.current.set(targetUserId, current)
    }

    const flushPendingIceCandidates = async (targetUserId, peer) => {
      if (!peer?.remoteDescription) return
      const pendingCandidates = pendingIceCandidatesRef.current.get(targetUserId) || []
      if (!pendingCandidates.length) return

      for (const candidatePayload of pendingCandidates) {
        await peer.addIceCandidate(new RTCIceCandidate(candidatePayload))
      }
      pendingIceCandidatesRef.current.delete(targetUserId)
    }

    const createPeerConnection = (targetUserId) => {
      if (peerConnectionsRef.current.has(targetUserId)) {
        return peerConnectionsRef.current.get(targetUserId)
      }

      const peer = new RTCPeerConnection({ iceServers: getIceServers() })
      peerConnectionsRef.current.set(targetUserId, peer)

      localStreamRef.current?.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current)
      })

      peer.onicecandidate = (event) => {
        if (event.candidate && signalingRef.current) {
          signalingRef.current.send({
            type: 'ice_candidate',
            target_user_id: targetUserId,
            payload: event.candidate
          })
        }
      }

      peer.ontrack = (event) => {
        const [stream] = event.streams
        if (!stream) return
        remoteStreamsRef.current.set(targetUserId, stream)
        setRemoteParticipants((current) => {
          const others = current.filter((participant) => participant.userId !== targetUserId)
          return [...others, { userId: targetUserId, stream }]
        })
      }

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed') {
          setError('A participant connection failed. The room may need a refresh.')
        }
      }

      return peer
    }

    const handleMessage = async (message) => {
      if (disposed) return
      if (message.type === 'meeting_state') {
        setParticipants(message.participants || [])
        return
      }

      if (message.type === 'user_joined') {
        const participant = message.participant
        setParticipants((current) => {
          const filtered = current.filter((entry) => entry.user_id !== participant.user_id)
          return [...filtered, participant]
        })
        if (participant.user_id !== user.id) {
          const peer = createPeerConnection(participant.user_id)
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          signalingRef.current?.send({
            type: 'offer',
            target_user_id: participant.user_id,
            payload: offer
          })
        }
        return
      }

      if (message.type === 'user_left') {
        const targetUserId = message.user_id
        const peer = peerConnectionsRef.current.get(targetUserId)
        if (peer) {
          peer.close()
          peerConnectionsRef.current.delete(targetUserId)
        }
        remoteStreamsRef.current.delete(targetUserId)
        setRemoteParticipants((current) => current.filter((participant) => participant.userId !== targetUserId))
        setParticipants((current) => current.filter((participant) => participant.user_id !== targetUserId))
        return
      }

      if (message.type === 'offer') {
        const sourceUserId = message.from_user_id
        const peer = createPeerConnection(sourceUserId)
        await peer.setRemoteDescription(new RTCSessionDescription(message.payload))
        await flushPendingIceCandidates(sourceUserId, peer)
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        signalingRef.current?.send({
          type: 'answer',
          target_user_id: sourceUserId,
          payload: answer
        })
        return
      }

      if (message.type === 'answer') {
        const sourceUserId = message.from_user_id
        const peer = createPeerConnection(sourceUserId)
        await peer.setRemoteDescription(new RTCSessionDescription(message.payload))
        await flushPendingIceCandidates(sourceUserId, peer)
        return
      }

      if (message.type === 'ice_candidate') {
        const sourceUserId = message.from_user_id
        const peer = createPeerConnection(sourceUserId)
        if (message.payload) {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(message.payload))
          } else {
            queueIceCandidate(sourceUserId, message.payload)
          }
        }
        return
      }

      if (message.type === 'end_meeting') {
        setConnectionState('ended')
      }
    }

    const start = async () => {
      try {
        setConnectionState('requesting_media')
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        localStreamRef.current = stream
        setLocalStream(stream)
        setConnectionState('connecting')

        signalingRef.current = createMeetingSignalingClient({
          meetingId,
          token,
          onOpen: () => {
            setConnectionState('connected')
            signalingRef.current?.send({
              type: 'join_meeting',
              payload: {
                classroom_id: null,
                user_id: user.id,
                full_name: user.full_name
              }
            })
          },
          onMessage: (payload) => {
            Promise.resolve(handleMessage(payload)).catch((err) => {
              setError(err.message || 'A meeting signaling error occurred.')
            })
          },
          onClose: () => {
            setConnectionState('disconnected')
          },
          onError: () => {
            setError('Could not connect to the meeting room.')
          }
        })
      } catch (err) {
        setError(err.message || 'Camera and microphone access are required to join the meeting.')
        setConnectionState('error')
      }
    }

    start()

    return () => {
      disposed = true
      signalingRef.current?.close()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      peerConnectionsRef.current.forEach((peer) => peer.close())
      peerConnectionsRef.current.clear()
      pendingIceCandidatesRef.current.clear()
      remoteStreamsRef.current.clear()
    }
  }, [enabled, meetingId, token, user?.id, user?.full_name])

  const toggleMute = () => {
    const nextMuted = !isMuted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    signalingRef.current?.send({ type: 'mute_status', payload: { muted: nextMuted } })
    setIsMuted(nextMuted)
  }

  const toggleCamera = () => {
    const nextCameraOff = !isCameraOff
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff
    })
    signalingRef.current?.send({ type: 'camera_status', payload: { camera_off: nextCameraOff } })
    setIsCameraOff(nextCameraOff)
  }

  const leaveMeeting = () => {
    signalingRef.current?.close()
    setConnectionState('left')
  }

  const endMeeting = () => {
    signalingRef.current?.send({ type: 'end_meeting', payload: {} })
    setConnectionState('ending')
  }

  return {
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
  }
}
