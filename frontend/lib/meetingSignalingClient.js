import { toWebSocketBase } from './backendApi'

export function createMeetingSignalingClient({ meetingId, token, onMessage, onOpen, onClose, onError }) {
  const base = toWebSocketBase()
  if (!base) {
    throw new Error('Meeting signaling is not configured. Add NEXT_PUBLIC_API_URL or NEXT_PUBLIC_WS_URL.')
  }
  const url = `${base}/api/classrooms/ws/meetings/${meetingId}?token=${encodeURIComponent(token)}`
  const socket = new WebSocket(url)

  socket.addEventListener('open', () => {
    onOpen?.()
  })

  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data)
      onMessage?.(payload)
    } catch (error) {
      onError?.(error)
    }
  })

  socket.addEventListener('close', () => {
    onClose?.()
  })

  socket.addEventListener('error', (event) => {
    onError?.(event)
  })

  return {
    send(payload) {
      socket.send(JSON.stringify(payload))
    },
    close() {
      socket.close()
    }
  }
}
