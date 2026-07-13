import { useEffect, useRef, useState } from 'react'

import { createMeetingSignalingClient } from '../lib/meetingSignalingClient'

const DEFAULT_STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

const splitIceServerUrls = (value) =>
  String(value || '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const normalizeIceServerEntries = (value) => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    const entries = Array.isArray(parsed) ? parsed : [parsed]
    return entries
      .map((entry) => {
        if (typeof entry === 'string') return { urls: entry }
        if (entry?.urls) return { ...entry }
        return null
      })
      .filter(Boolean)
  } catch (_error) {
    return splitIceServerUrls(value).map((url) => ({ urls: url }))
  }
}

const serverUsesTurnRelay = (server) => {
  const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
  return urls.some((url) => /^turns?:/i.test(String(url || '')))
}

const getIceServers = () => {
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_PASSWORD
  const configuredIceServers = normalizeIceServerEntries(
    process.env.NEXT_PUBLIC_TURN_URLS || process.env.NEXT_PUBLIC_TURN_URL
  )

  const usableConfiguredServers = configuredIceServers
    .map((server) => {
      if (!serverUsesTurnRelay(server)) return server
      if (!username || !credential) return null
      return { ...server, username, credential }
    })
    .filter(Boolean)

  // TURN over TLS, e.g. turns:global.relay.metered.ca:443?transport=tcp, is supported through NEXT_PUBLIC_TURN_URLS.
  return [...DEFAULT_STUN_SERVERS, ...usableConfiguredServers]
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
  const offerInFlightRef = useRef(new Set())
  const iceRestartInFlightRef = useRef(new Set())
  const pendingIceCandidatesRef = useRef(new Map())
  const remoteStreamsRef = useRef(new Map())
  const localStreamRef = useRef(null)
  const makingOfferRef = useRef(new Set())

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

    const shouldInitiateOffer = (targetUserId) => String(user.id) < String(targetUserId)
    const isPolitePeer = (targetUserId) => String(user.id) > String(targetUserId)

    const createAndSendOffer = async (targetUserId, { iceRestart = false } = {}) => {
      if (!signalingRef.current || offerInFlightRef.current.has(targetUserId)) return
      const peer = createPeerConnection(targetUserId)
      if (!peer || (peer.signalingState !== 'stable' && !iceRestart)) return

      offerInFlightRef.current.add(targetUserId)
      makingOfferRef.current.add(targetUserId)
      try {
        const offer = await peer.createOffer(iceRestart ? { iceRestart: true } : undefined)
        if (peer.signalingState !== 'stable' && !iceRestart) return
        await peer.setLocalDescription(offer)
        signalingRef.current?.send({
          type: 'offer',
          target_user_id: targetUserId,
          payload: offer
        })
      } finally {
        makingOfferRef.current.delete(targetUserId)
        offerInFlightRef.current.delete(targetUserId)
        iceRestartInFlightRef.current.delete(targetUserId)
      }
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
        const [providedStream] = event.streams || []
        const stream = providedStream || remoteStreamsRef.current.get(targetUserId) || new MediaStream()
        if (!providedStream && event.track && !stream.getTracks().some((track) => track.id === event.track.id)) {
          stream.addTrack(event.track)
        }
        remoteStreamsRef.current.set(targetUserId, stream)
        setRemoteParticipants((current) => {
          const others = current.filter((participant) => participant.userId !== targetUserId)
          return [...others, { userId: targetUserId, stream }]
        })
      }

      peer.onnegotiationneeded = async () => {
        if (!shouldInitiateOffer(targetUserId)) return
        await createAndSendOffer(targetUserId)
      }

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed') {
          setError('A participant connection dropped. VYDRA CORE is trying to reconnect it.')
          if (!iceRestartInFlightRef.current.has(targetUserId)) {
            iceRestartInFlightRef.current.add(targetUserId)
            createAndSendOffer(targetUserId, { iceRestart: true }).catch(() => {})
          }
        }
      }

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'disconnected') {
          if (!iceRestartInFlightRef.current.has(targetUserId)) {
            iceRestartInFlightRef.current.add(targetUserId)
            createAndSendOffer(targetUserId, { iceRestart: true }).catch(() => {})
          }
        }
      }

      return peer
    }

    const syncParticipantConnection = async (participant) => {
      if (!participant?.user_id || participant.user_id === user.id) return
      createPeerConnection(participant.user_id)
      if (shouldInitiateOffer(participant.user_id)) {
        await createAndSendOffer(participant.user_id)
      }
    }

    const handleMessage = async (message) => {
      if (disposed) return
      if (message.type === 'meeting_state') {
        const nextParticipants = message.participants || []
        setParticipants(nextParticipants)
        for (const participant of nextParticipants) {
          await syncParticipantConnection(participant)
        }
        return
      }

      if (message.type === 'user_joined') {
        const participant = message.participant
        setParticipants((current) => {
          const filtered = current.filter((entry) => entry.user_id !== participant.user_id)
          return [...filtered, participant]
        })
        await syncParticipantConnection(participant)
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
        const offerCollision =
          makingOfferRef.current.has(sourceUserId) || peer.signalingState !== 'stable'
        if (!isPolitePeer(sourceUserId) && offerCollision) {
          return
        }

        if (offerCollision) {
          await Promise.all([
            peer.setLocalDescription({ type: 'rollback' }),
            peer.setRemoteDescription(new RTCSessionDescription(message.payload))
          ])
        } else {
          await peer.setRemoteDescription(new RTCSessionDescription(message.payload))
        }
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
        if (peer.signalingState !== 'have-local-offer') return
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
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
      offerInFlightRef.current.clear()
      iceRestartInFlightRef.current.clear()
      makingOfferRef.current.clear()
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
