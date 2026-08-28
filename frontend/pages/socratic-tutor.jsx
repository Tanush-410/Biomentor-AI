import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Eraser, Mic, MicOff, Send, Volume2 } from 'lucide-react'

import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import { normalizeListPayload, requestBackendJson } from '../lib/backendApi'

const LANGUAGES = [
  { code: 'en', label: 'English', speechLocale: 'en-IN' },
  { code: 'hi', label: 'Hindi', speechLocale: 'hi-IN' },
  { code: 'ta', label: 'Tamil', speechLocale: 'ta-IN' },
  { code: 'te', label: 'Telugu', speechLocale: 'te-IN' },
  { code: 'kn', label: 'Kannada', speechLocale: 'kn-IN' },
  { code: 'bn', label: 'Bengali', speechLocale: 'bn-IN' },
  { code: 'mr', label: 'Marathi', speechLocale: 'mr-IN' },
  { code: 'de', label: 'German', speechLocale: 'de-DE' },
  { code: 'pt', label: 'Portuguese', speechLocale: 'pt-PT' },
  { code: 'nl', label: 'Dutch', speechLocale: 'nl-NL' },
  { code: 'zh', label: 'Chinese', speechLocale: 'zh-CN' },
  { code: 'ja', label: 'Japanese', speechLocale: 'ja-JP' },
]

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500

function drawShape(ctx, shape) {
  ctx.strokeStyle = shape.color || '#18181b'
  ctx.fillStyle = shape.color || '#18181b'
  ctx.lineWidth = 2
  ctx.font = '16px sans-serif'

  if (shape.type === 'rect') {
    ctx.strokeRect(shape.x, shape.y, shape.width || 100, shape.height || 60)
    if (shape.text) ctx.fillText(shape.text, shape.x + 6, shape.y + (shape.height || 60) / 2)
  } else if (shape.type === 'circle') {
    const r = (shape.width || 80) / 2
    ctx.beginPath()
    ctx.arc(shape.x + r, shape.y + r, r, 0, Math.PI * 2)
    ctx.stroke()
    if (shape.text) ctx.fillText(shape.text, shape.x + r - 15, shape.y + r + 5)
  } else if (shape.type === 'arrow') {
    const { x, y, x2 = x + 60, y2 = y } = shape
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    const angle = Math.atan2(y2 - y, x2 - x)
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fill()
  } else if (shape.type === 'text' && shape.text) {
    ctx.fillText(shape.text, shape.x, shape.y)
  }
}

export default function SocraticTutorPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()

  const [documents, setDocuments] = useState([])
  const [selectedDoc, setSelectedDoc] = useState('')
  const [topic, setTopic] = useState('')
  const [language, setLanguage] = useState('en')

  const [session, setSession] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [soloLevel, setSoloLevel] = useState(null)
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [textInput, setTextInput] = useState('')
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)

  const canvasRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptEndRef = useRef(null)

  const activeLanguage = useMemo(() => LANGUAGES.find((l) => l.code === language) || LANGUAGES[0], [language])

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    requestBackendJson('/documents/', { headers: { Authorization: `Bearer ${token}` } })
      .then((payload) => setDocuments(normalizeListPayload(payload)))
      .catch(() => setDocuments([]))
  }, [authLoading, token])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const speak = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new window.SpeechSynthesisUtterance(text.replace(/\n+/g, ' '))
      utterance.lang = activeLanguage.speechLocale
      const voices = window.speechSynthesis.getVoices()
      const match = voices.find((v) => v.lang === activeLanguage.speechLocale) || voices.find((v) => v.lang.startsWith(language))
      if (match) utterance.voice = match
      window.speechSynthesis.speak(utterance)
    } catch {
      // Speech synthesis is a convenience layer -- the transcript still
      // shows the text either way, so a failure here is silent.
    }
  }

  const drawDiagram = (shapes) => {
    const canvas = canvasRef.current
    if (!canvas || !shapes?.length) return
    const ctx = canvas.getContext('2d')
    shapes.forEach((shape) => drawShape(ctx, shape))
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }

  const handleStart = async () => {
    setStarting(true)
    setError('')
    try {
      const data = await requestBackendJson('/socratic/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          document_id: selectedDoc || null,
          topic: topic.trim() || null,
          language,
        },
      })
      setSession({ id: data.session_id, status: data.status })
      setSoloLevel({ level: data.solo_level, name: data.solo_level_name })
      setTranscript([{ role: 'tutor', text: data.tutor_message }])
      clearCanvas()
      speak(data.tutor_message)
    } catch (err) {
      setError(err.message || 'Could not start the tutoring session.')
    } finally {
      setStarting(false)
    }
  }

  const submitMessage = async (message) => {
    const trimmed = message.trim()
    if (!trimmed || !session || sending) return
    setSending(true)
    setError('')
    setTranscript((prev) => [...prev, { role: 'student', text: trimmed }])
    setTextInput('')

    try {
      const data = await requestBackendJson(`/socratic/${session.id}/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { message: trimmed },
      })
      setSoloLevel({ level: data.solo_level, name: data.solo_level_name })
      setTranscript((prev) => [...prev, { role: 'tutor', text: data.tutor_message }])
      if (data.diagram?.length) drawDiagram(data.diagram)
      speak(data.tutor_message)
    } catch (err) {
      setError(err.message || 'Could not process that answer.')
    } finally {
      setSending(false)
    }
  }

  const toggleListening = () => {
    if (!speechSupported) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = activeLanguage.speechLocale
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript
      if (said) submitMessage(said)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const handleEnd = async () => {
    if (!session) return
    try {
      await requestBackendJson(`/socratic/${session.id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // Ending is best-effort -- the student leaving the page is enough
      // either way, no need to block on it.
    }
    setSession(null)
    setTranscript([])
    setSoloLevel(null)
  }

  if (authLoading || !token) return null

  return (
    <AppShell
      eyebrow="STEM Education"
      title="Voice-Based Socratic Tutor"
      description="A spoken, question-led study session grounded in your own material -- available in English, Hindi, Tamil, Telugu, and Kannada. The tutor never gives the answer away; it asks the next question that gets you there."
    >
      {!session ? (
        <section className="card max-w-2xl p-6">
          <h2 className="text-lg font-bold text-slate-950">Start a session</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pick a language, and optionally a topic or one of your documents. Leave both blank and the tutor will focus on your weakest known area.
          </p>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      language === lang.code ? 'border-black bg-black text-[#d9c25c]' : 'border-zinc-300 bg-white text-zinc-700 hover:border-black/40'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Topic (optional)</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. photosynthesis, Newton's laws"
                className="input mt-2"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document (optional)</label>
              <select value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)} className="input mt-2">
                <option value="">No specific document</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title || doc.filename}</option>
                ))}
              </select>
            </div>

            {error && <div className="rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-900">{error}</div>}

            {!speechSupported && (
              <p className="text-xs text-zinc-500">
                Voice input isn&apos;t supported in this browser -- you can still type your answers. Chrome on desktop/Android has the best support.
              </p>
            )}

            <button onClick={handleStart} disabled={starting} className="btn btn-primary w-full">
              {starting ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="card flex flex-col p-6" style={{ minHeight: '520px' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {activeLanguage.label} &middot; {soloLevel ? `SOLO: ${soloLevel.name}` : ''}
                </p>
              </div>
              <button onClick={handleEnd} className="btn btn-outline text-sm">End Session</button>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: '360px' }}>
              {transcript.map((turn, idx) => (
                <div key={idx} className={`flex ${turn.role === 'tutor' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-6 whitespace-pre-wrap ${
                      turn.role === 'tutor' ? 'bg-zinc-100 text-zinc-900' : 'bg-black text-[#d9c25c]'
                    }`}
                  >
                    {turn.role === 'tutor' && (
                      <button onClick={() => speak(turn.text)} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                        <Volume2 className="h-3 w-3" /> Replay
                      </button>
                    )}
                    <div>{turn.text}</div>
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            {error && <div className="mt-3 rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-900">{error}</div>}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                disabled={!speechSupported || sending}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                  listening ? 'border-red-500 bg-red-50 text-red-600' : 'border-zinc-300 text-zinc-700 hover:border-black/40'
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={speechSupported ? 'Speak your answer' : 'Voice input not supported in this browser'}
              >
                {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitMessage(textInput)}
                placeholder="Type your answer..."
                className="input flex-1"
                disabled={sending}
              />
              <button onClick={() => submitMessage(textInput)} disabled={sending || !textInput.trim()} className="btn btn-primary shrink-0">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Whiteboard</p>
              <button onClick={clearCanvas} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                <Eraser className="h-3 w-3" /> Clear
              </button>
            </div>
            <SocraticWhiteboardCanvas canvasRef={canvasRef} />
            <p className="mt-3 text-xs text-slate-500">
              Draw your own working-out here. The tutor will sometimes add a diagram of its own to the same board.
            </p>
          </section>
        </div>
      )}
    </AppShell>
  )
}

function SocraticWhiteboardCanvas({ canvasRef }) {
  const drawingRef = useRef(false)

  const getPos = (canvas, e) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    }
  }

  const start = (e) => {
    drawingRef.current = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(canvas, e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(canvas, e)
    ctx.strokeStyle = '#18181b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    drawingRef.current = false
  }

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="w-full touch-none rounded-2xl border border-zinc-200 bg-white"
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={end}
    />
  )
}
