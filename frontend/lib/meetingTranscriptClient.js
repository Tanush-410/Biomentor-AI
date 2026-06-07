export function createMeetingTranscriptClient({ onSnippet }) {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null

  let recognition = null
  let shouldRestart = false
  let manuallyStopped = false

  function scheduleRestart() {
    window.setTimeout(() => {
      if (shouldRestart && !recognition) {
        start()
      }
    }, 800)
  }

  function start() {
    if (!SpeechRecognition || recognition) return
    shouldRestart = true
    manuallyStopped = false

    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const last = event.results?.[event.results.length - 1]
      const transcript = last?.[0]?.transcript?.trim()
      if (transcript) {
        onSnippet?.(transcript)
      }
    }
    recognition.onerror = () => {}
    recognition.onend = () => {
      recognition = null
      if (!manuallyStopped) {
        scheduleRestart()
      }
    }
    recognition.start()
  }

  function stop() {
    shouldRestart = false
    manuallyStopped = true
    recognition?.stop?.()
    recognition = null
  }

  return {
    isSupported: Boolean(SpeechRecognition),
    start,
    stop
  }
}
