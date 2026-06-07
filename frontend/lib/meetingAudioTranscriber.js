function getSupportedMimeType() {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType)) || ''
}

export function createMeetingAudioTranscriber({ onChunk, timeslice = 8000 }) {
  const AudioContextClass =
    typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null

  let audioContext = null
  let mediaRecorder = null
  let destination = null
  let sourceNodes = []
  let isStarted = false

  const supportedMimeType = getSupportedMimeType()

  const stopRecorder = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    mediaRecorder = null
  }

  const disconnectSources = () => {
    sourceNodes.forEach((node) => node.disconnect())
    sourceNodes = []
  }

  const destroyAudioGraph = () => {
    disconnectSources()
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    destination = null
  }

  const attachStreams = async (streams) => {
    if (!AudioContextClass || !supportedMimeType) return

    if (!audioContext) {
      audioContext = new AudioContextClass()
      destination = audioContext.createMediaStreamDestination()
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => {})
    }

    disconnectSources()

    ;(streams || [])
      .filter(Boolean)
      .forEach((stream) => {
        const hasAudio = stream.getAudioTracks().some((track) => track.readyState === 'live' && track.enabled)
        if (!hasAudio) return
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(destination)
        sourceNodes.push(source)
      })

    stopRecorder()

    const mixedStream = destination?.stream
    if (!mixedStream || mixedStream.getAudioTracks().length === 0) return

    mediaRecorder = new MediaRecorder(mixedStream, supportedMimeType ? { mimeType: supportedMimeType } : undefined)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        onChunk?.(event.data)
      }
    }
    mediaRecorder.start(timeslice)
  }

  const start = async (streams) => {
    isStarted = true
    await attachStreams(streams)
  }

  const updateStreams = async (streams) => {
    if (!isStarted) return
    await attachStreams(streams)
  }

  const stop = () => {
    isStarted = false
    stopRecorder()
    destroyAudioGraph()
  }

  return {
    isSupported: Boolean(AudioContextClass && supportedMimeType && typeof MediaRecorder !== 'undefined'),
    start,
    updateStreams,
    stop
  }
}
