function toWebSocketBase(apiBase) {
  if (!apiBase) return ''
  if (apiBase.startsWith('https://')) return apiBase.replace('https://', 'wss://')
  if (apiBase.startsWith('http://')) return apiBase.replace('http://', 'ws://')
  return apiBase
}

export function createMeetingSignalingClient({ meetingId, token, onMessage, onOpen, onClose, onError }) {
  const base = toWebSocketBase(process.env.NEXT_PUBLIC_API_URL || '')
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
