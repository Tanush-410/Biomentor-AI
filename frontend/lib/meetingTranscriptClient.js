export function createMeetingTranscriptClient({ onSnippet }) {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null

  let recognition = null

  function start() {
    if (!SpeechRecognition || recognition) return

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
    }
    recognition.start()
  }

  function stop() {
    recognition?.stop?.()
    recognition = null
  }

  return {
    isSupported: Boolean(SpeechRecognition),
    start,
    stop
  }
}
