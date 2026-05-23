import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Camera, CheckCircle, Clock3, Shield, Video } from 'lucide-react'
import { useRouter } from 'next/router'

import ClassroomShell from '../../../../components/ClassroomShell'
import { useAuth } from '../../../../context/AuthContext'
import {
  getClassroom,
  getClassroomQuiz,
  reportClassroomQuizViolation,
  startClassroomQuizAttempt,
  submitClassroomQuizAttempt
} from '../../../../lib/classroomApi'

export default function ClassroomQuizPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attempt, setAttempt] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [attemptState, setAttemptState] = useState('idle')
  const [cameraError, setCameraError] = useState('')
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const violationSentRef = useRef(false)

  const classroomId = typeof router.query.id === 'string' ? router.query.id : ''
  const quizId = typeof router.query.quizId === 'string' ? router.query.quizId : ''
  const isStudent = user?.role === 'student'
  const isEducator = ['educator', 'admin'].includes(user?.role)

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!classroomId || !quizId) return
    loadPage()
  }, [authLoading, token, router.isReady, classroomId, quizId])

  useEffect(() => () => stopCamera(), [])

  useEffect(() => {
    if (attemptState !== 'active' || !attempt || !quiz) return undefined

    const tick = () => {
      const now = Date.now()
      const startedAt = attempt.started_at ? new Date(attempt.started_at).getTime() : now
      const durationEnd = startedAt + (quiz.duration_minutes || 15) * 60 * 1000
      const hardClose = quiz.available_until ? new Date(quiz.available_until).getTime() : durationEnd
      const remaining = Math.max(0, Math.floor((Math.min(durationEnd, hardClose) - now) / 1000))
      setTimeRemaining(remaining)
      if (remaining === 0) {
        handleSubmit()
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [attemptState, attempt, quiz])

  useEffect(() => {
    if (attemptState !== 'active' || !quiz?.proctoring_enabled) return undefined

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('tab_hidden', { hidden: true })
      }
    }

    const onBlur = () => handleViolation('window_blur', { pathname: window.location.pathname })

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation('fullscreen_exit', { activeElement: document.activeElement?.tagName || null })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [attemptState, quiz?.proctoring_enabled, attempt?.id])

  const loadPage = async () => {
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, quizPayload] = await Promise.all([
        getClassroom(token, classroomId),
        getClassroomQuiz(token, classroomId, quizId)
      ])
      setClassroom(classroomPayload.classroom)
      setQuiz(quizPayload.quiz)
      setAttempt(quizPayload.quiz?.attempt || null)
      if (quizPayload.quiz?.attempt?.status === 'submitted') {
        setAttemptState('submitted')
      } else if (quizPayload.quiz?.attempt?.status === 'terminated') {
        setAttemptState('terminated')
      } else {
        setAttemptState('idle')
      }
    } catch (err) {
      setError(err.message || 'Could not load classroom quiz.')
    } finally {
      setLoading(false)
    }
  }

  const stopCamera = () => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const ensureCameraAndFullscreen = async () => {
    setCameraError('')
    if (!quiz?.proctoring_enabled) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          handleViolation('camera_lost', { label: track.label || 'camera' })
        }
      })
    } catch (err) {
      setCameraError('Camera access is required for this classroom quiz.')
      throw err
    }

    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen()
      } catch (err) {
        setCameraError('Fullscreen is required before the quiz can begin.')
        throw err
      }
    }
  }

  const handleStart = async () => {
    setStarting(true)
    setError('')
    try {
      await ensureCameraAndFullscreen()
      const payload = await startClassroomQuizAttempt(token, classroomId, quizId)
      violationSentRef.current = false
      setAttempt(payload.attempt)
      setQuiz(payload.quiz)
      setQuestions(payload.questions || [])
      setAnswers({})
      setCurrentIndex(0)
      setAttemptState('active')
    } catch (err) {
      if (!cameraError) {
        setError(err.message || 'Could not start the classroom quiz.')
      }
      stopCamera()
    } finally {
      setStarting(false)
    }
  }

  const handleViolation = async (type, details = {}) => {
    if (!attempt?.id || violationSentRef.current || attemptState !== 'active') return
    violationSentRef.current = true
    try {
      const payload = await reportClassroomQuizViolation(token, classroomId, quizId, {
        attempt_id: attempt.id,
        violation_type: type,
        details
      })
      setAttempt(payload.attempt || null)
      setAttemptState('terminated')
      setError('This quiz was ended automatically because a proctoring rule was broken.')
    } catch (err) {
      setError(err.message || 'The quiz could not continue after a proctoring event.')
      setAttemptState('terminated')
    } finally {
      stopCamera()
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  const handleSubmit = async () => {
    if (!attempt?.id || submitting) return
    setSubmitting(true)
    setError('')
    violationSentRef.current = true
    try {
      const response = await submitClassroomQuizAttempt(token, classroomId, quizId, {
        attempt_id: attempt.id,
        answers: Object.entries(answers).map(([question_id, selected_option_id]) => ({
          question_id,
          selected_option_id
        })),
        total_questions: questions.length
      })
      setAttempt(response.attempt)
      setAttemptState('submitted')
      stopCamera()
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    } catch (err) {
      violationSentRef.current = false
      setError(err.message || 'Could not submit classroom quiz.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeQuestion = questions[currentIndex]
  const answeredCount = Object.keys(answers).length
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const availabilityLabel = useMemo(() => {
    if (!quiz) return ''
    if (quiz.availability_state === 'upcoming') return 'Scheduled'
    if (quiz.availability_state === 'closed') return 'Closed'
    return 'Open'
  }, [quiz])

  return (
    <ClassroomShell classroom={classroom} activeTab="classwork" isLoading={loading} error={error}>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="card p-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="role-pill border-[#d8c1aa] bg-[#f5ebdf] text-[#6d472d]">{availabilityLabel}</span>
              {quiz?.proctoring_enabled && <span className="role-pill border-[#d9b38f] bg-[#fff3e7] text-[#8a5a36]">Camera-proctored</span>}
            </div>
            <h2 className="mt-4 text-3xl font-bold text-slate-950">{quiz?.title || 'Classroom quiz'}</h2>
            {quiz?.description && <p className="mt-3 text-sm leading-7 text-slate-600">{quiz.description}</p>}

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a5a36]">Questions</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{quiz?.num_questions || 0}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a5a36]">Duration</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{quiz?.duration_minutes || 0} min</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a5a36]">Material</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{quiz?.document?.title || 'Mixed class material'}</p>
              </div>
            </div>
          </div>

          {!isStudent && (
            <div className="card p-8">
              <h3 className="text-2xl font-bold text-slate-950">Educator view</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                This quiz is published to the classroom. Students will see it in Classwork and can only begin during the allowed time window. If proctoring is enabled, any fullscreen, tab, or camera violation ends the attempt and notifies you immediately.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/classrooms/${classroomId}/classwork`} className="btn btn-outline">Back to Classwork</Link>
                <Link href="/educator/quiz-maker" className="btn btn-primary">Create Another Quiz</Link>
              </div>
            </div>
          )}

          {isStudent && attemptState === 'idle' && (
            <div className="card p-8">
              <h3 className="text-2xl font-bold text-slate-950">Ready to begin?</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                You must stay in fullscreen, keep this tab visible, and keep your camera on while the quiz is active. Breaking a proctoring rule ends the quiz automatically.
              </p>
              {cameraError && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">{cameraError}</div>}
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" onClick={handleStart} disabled={starting || quiz?.availability_state !== 'published'}>
                  {starting ? 'Starting...' : 'Start Classroom Quiz'}
                </button>
                <Link href={`/classrooms/${classroomId}/classwork`} className="btn btn-outline">Back to Classwork</Link>
              </div>
            </div>
          )}

          {isStudent && attemptState === 'active' && activeQuestion && (
            <div className="card p-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker text-[#8a5a36]">Proctored attempt</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">Question {currentIndex + 1} of {questions.length}</h3>
                </div>
                <div className="rounded-full bg-[#f5ebdf] px-4 py-2 font-semibold text-[#6d472d]">{formatTime(timeRemaining)}</div>
              </div>

              <div className="mb-6 w-full rounded-full bg-stone-200 h-2">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#7c4f30] to-[#c59a73] transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
              </div>

              <h4 className="text-xl font-bold text-slate-950">{activeQuestion.text}</h4>
              {activeQuestion.source_excerpt && (
                <div className="mt-4 rounded-2xl border border-[#d6b89c] bg-[#f7ecdf] px-4 py-3 text-sm text-[#6b452c]">
                  <p className="font-semibold mb-1">Source grounding</p>
                  <p>{activeQuestion.source_excerpt}</p>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {(activeQuestion.options || []).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAnswers((current) => ({ ...current, [activeQuestion.id]: option.id }))}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      answers[activeQuestion.id] === option.id
                        ? 'border-[#8a5a36] bg-[#f6e8d8] text-[#4d3220]'
                        : 'border-stone-200 bg-white text-slate-800 hover:border-[#d5b08b]'
                    }`}
                  >
                    <span className="font-semibold mr-2">{option.id}.</span>
                    {option.text}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <button type="button" className="btn btn-outline" onClick={() => setCurrentIndex((current) => Math.max(0, current - 1))} disabled={currentIndex === 0}>
                  Previous
                </button>
                <div className="flex gap-3">
                  {currentIndex < questions.length - 1 ? (
                    <button type="button" className="btn btn-primary" onClick={() => setCurrentIndex((current) => Math.min(questions.length - 1, current + 1))}>
                      Next
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Quiz'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isStudent && attemptState === 'submitted' && (
            <div className="card p-10 text-center">
              <CheckCircle className="mx-auto h-20 w-20 text-[#8a5a36]" />
              <h3 className="mt-5 text-3xl font-bold text-slate-950">Quiz submitted</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">Your classroom quiz attempt has been saved. Your educator can now review the result.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href={`/classrooms/${classroomId}/classwork`} className="btn btn-primary">Back to Classwork</Link>
              </div>
            </div>
          )}

          {isStudent && attemptState === 'terminated' && (
            <div className="card p-10 text-center">
              <AlertTriangle className="mx-auto h-20 w-20 text-[#a6513f]" />
              <h3 className="mt-5 text-3xl font-bold text-slate-950">Quiz ended automatically</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                A proctoring rule was broken, so the attempt was terminated and your educator has been notified.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href={`/classrooms/${classroomId}/classwork`} className="btn btn-outline">Return to Classwork</Link>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-6">
            <p className="section-kicker text-[#8a5a36]">Attempt guard</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Proctoring status</h3>
            <div className="mt-5 space-y-4">
              <div className="surface-quiet flex items-center gap-3 p-4">
                <Shield className="h-5 w-5 text-[#8a5a36]" />
                <div>
                  <p className="font-semibold text-slate-900">{quiz?.proctoring_enabled ? 'Protected attempt' : 'Standard attempt'}</p>
                  <p className="text-sm text-slate-600">Fullscreen, visibility, and camera signals are checked while the quiz is live.</p>
                </div>
              </div>
              <div className="surface-quiet p-4">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-[#8a5a36]" />
                  <div>
                    <p className="font-semibold text-slate-900">Camera preview</p>
                    <p className="text-sm text-slate-600">Students must keep the webcam feed available during a proctored attempt.</p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl bg-[#2f2219]">
                  <video ref={videoRef} autoPlay muted playsInline className="h-48 w-full object-cover" />
                </div>
              </div>
              {attemptState === 'active' && (
                <div className="surface-subtle p-4 text-sm text-slate-700">
                  {answeredCount} of {questions.length} answered
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </ClassroomShell>
  )
}
