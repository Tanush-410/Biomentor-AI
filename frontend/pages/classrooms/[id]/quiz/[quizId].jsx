import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Camera, CheckCircle, Clock3, Shield, Video } from 'lucide-react'
import { useRouter } from 'next/router'

import ClassroomShell from '../../../../components/ClassroomShell'
import ProctorReviewPanel from '../../../../components/ProctorReviewPanel'
import { useAuth } from '../../../../context/AuthContext'
import {
  getClassroom,
  getClassroomQuiz,
  getClassroomQuizProctorReview,
  heartbeatClassroomQuizAttempt,
  reportClassroomQuizWarning,
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
  const [warningCount, setWarningCount] = useState(0)
  const [latestWarning, setLatestWarning] = useState('')
  const [proctorReview, setProctorReview] = useState(null)
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const violationSentRef = useRef(false)
  const warningTimestampsRef = useRef({})
  const AI_DEBARMENT_REASON = 'ai_proctoring_debarred'

  const classroomId = typeof router.query.id === 'string' ? router.query.id : ''
  const quizId = typeof router.query.quizId === 'string' ? router.query.quizId : ''
  const isStudent = user?.role === 'student'
  const isEducator = ['educator', 'admin'].includes(user?.role)
  const canBeginQuiz = quiz?.availability_state === 'published'

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
      const startedAt = parseServerDate(attempt.started_at)?.getTime() || now
      const durationEnd = startedAt + (quiz.duration_minutes || 15) * 60 * 1000
      const hardClose = parseServerDate(quiz.available_until)?.getTime() || durationEnd
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

    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

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

    const onContextMenu = (event) => {
      event.preventDefault()
      handleViolation('context_menu', { x: event.clientX, y: event.clientY })
    }

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const blockedCombo =
        (event.ctrlKey || event.metaKey) && ['a', 'c', 'i', 'j', 'n', 'p', 'r', 's', 'u', 'v', 'w', 'x'].includes(key)
      const blockedFunctionKey = event.key === 'F12'
      if (!blockedCombo && !blockedFunctionKey) return
      event.preventDefault()
      handleViolation('blocked_shortcut', {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      })
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [attemptState, quiz?.proctoring_enabled, attempt?.id])

  useEffect(() => {
    if (attemptState !== 'active' || !quiz?.proctoring_enabled || !attempt?.id) return undefined

    const heartbeat = async () => {
      try {
        const payload = await heartbeatClassroomQuizAttempt(token, classroomId, quizId, {
          attempt_id: attempt.id
        })
        if (payload?.attempt) {
          setAttempt((current) => ({ ...(current || {}), ...payload.attempt }))
        }
      } catch (_error) {
        // Keep the student's attempt running locally and let hard proctoring events decide termination.
      }
    }

    heartbeat()
    const interval = window.setInterval(heartbeat, 15000)
    return () => window.clearInterval(interval)
  }, [attemptState, quiz?.proctoring_enabled, attempt?.id, token, classroomId, quizId])

  const loadPage = async () => {
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, quizPayload, reviewPayload] = await Promise.all([
        getClassroom(token, classroomId),
        getClassroomQuiz(token, classroomId, quizId),
        isEducator ? getClassroomQuizProctorReview(token, classroomId, quizId) : Promise.resolve(null)
      ])
      setClassroom(classroomPayload.classroom)
      setQuiz(quizPayload.quiz)
      setProctorReview(reviewPayload)
      const latestAttempt = quizPayload.quiz?.attempt || null
      setAttempt(latestAttempt)
      setWarningCount(latestAttempt?.violation_count || 0)
      const quizStillOpen = quizPayload.quiz?.availability_state === 'published'
      if (latestAttempt?.status === 'terminated' && !quizStillOpen) {
        setAttemptState('terminated')
      } else if (latestAttempt?.status === 'submitted' && !quizStillOpen) {
        setAttemptState('submitted')
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

  const waitForEvidenceVideoFrame = (video, timeoutMs = 2500) =>
    new Promise((resolve) => {
      if (!video) {
        resolve(false)
        return
      }

      const hasFrame = () => video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0
      if (hasFrame()) {
        resolve(true)
        return
      }

      let settled = false
      let timeoutId = null
      const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing']
      const cleanup = () => {
        events.forEach((eventName) => video.removeEventListener(eventName, onReady))
        if (timeoutId) window.clearTimeout(timeoutId)
      }
      const finish = (value) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(value)
      }
      const onReady = () => {
        if (hasFrame()) finish(true)
      }

      events.forEach((eventName) => video.addEventListener(eventName, onReady))
      timeoutId = window.setTimeout(() => finish(hasFrame()), timeoutMs)
      try {
        const playResult = video.play?.()
        if (playResult?.catch) playResult.catch(() => {})
      } catch (_error) {
        // A blocked play call should not prevent a later loadeddata event from producing evidence.
      }
      onReady()
    })

  const captureEvidenceSnapshot = async () => {
    const video = videoRef.current
    if (!video) return null
    await waitForEvidenceVideoFrame(video, 1200)
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null

    const targetWidth = Math.min(960, video.videoWidth)
    const targetHeight = Math.max(1, Math.round((targetWidth / video.videoWidth) * video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, targetWidth, targetHeight)
    return canvas.toDataURL('image/jpeg', 0.78)
  }

  const buildEvidenceDetails = async (reasonCode, details = {}, nextWarningCount = warningCount + 1) => {
    const snapshot = await captureEvidenceSnapshot()
    return {
      ...details,
      reason_code: reasonCode,
      warning_count_snapshot: nextWarningCount,
      captured_at_client: new Date().toISOString(),
      evidence_image_data_url: snapshot,
      camera_dimensions: videoRef.current
        ? {
            width: videoRef.current.videoWidth || null,
            height: videoRef.current.videoHeight || null
          }
        : null
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
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        await waitForEvidenceVideoFrame(videoRef.current, 3000)
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
    setLatestWarning('')
    try {
      if (!canBeginQuiz) {
        throw new Error('This classroom quiz is not open for a new attempt right now.')
      }
      await ensureCameraAndFullscreen()
      const payload = await startClassroomQuizAttempt(token, classroomId, quizId)
      violationSentRef.current = false
      warningTimestampsRef.current = {}
      setAttempt(payload.attempt)
      setQuiz(payload.quiz)
      setQuestions(payload.questions || [])
      setAnswers({})
      setWarningCount(payload.attempt?.violation_count || 0)
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
      const evidenceDetails = await buildEvidenceDetails(type, details, warningCount + 1)
      const payload = await reportClassroomQuizViolation(token, classroomId, quizId, {
        attempt_id: attempt.id,
        violation_type: type,
        details: evidenceDetails
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

  const handleWarning = async (type, details = {}) => {
    if (!attempt?.id || attemptState !== 'active' || violationSentRef.current) return
    const now = Date.now()
    const lastSeenAt = warningTimestampsRef.current[type] || 0
    if (now - lastSeenAt < 20000) return
    warningTimestampsRef.current[type] = now

    try {
      const evidenceDetails = await buildEvidenceDetails(type, details, warningCount + 1)
      const payload = await reportClassroomQuizWarning(token, classroomId, quizId, {
        attempt_id: attempt.id,
        warning_type: type,
        details: evidenceDetails
      })
      if (payload?.attempt) {
        setAttempt(payload.attempt)
        setWarningCount(payload.warning_count || payload.attempt.violation_count || 0)
      }
      if (payload?.terminated) {
        violationSentRef.current = true
        setLatestWarning('AI proctoring detected repeated suspicious behaviour. Your attempt has been ended automatically.')
        setError('This quiz was ended automatically after repeated AI proctoring warnings.')
        if (payload?.attempt?.termination_reason === AI_DEBARMENT_REASON) {
          setAttemptState('terminated')
        } else {
          setAttemptState('terminated')
        }
        stopCamera()
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
        return
      }

      const warningMessages = {
        ai_multiple_faces: 'AI warning: more than one face was detected in the frame.',
        ai_face_missing: 'AI warning: your face is not clearly visible to the camera.',
        ai_looking_down: 'AI warning: possible off-screen or phone glance detected.'
      }
      setLatestWarning(warningMessages[type] || 'AI proctoring warning recorded.')
    } catch (_err) {
      // Keep the quiz active if the warning endpoint is temporarily unavailable.
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

  useEffect(() => {
    if (attemptState !== 'active' || !quiz?.proctoring_enabled || !attempt?.id) return undefined
    if (typeof window === 'undefined' || !('FaceDetector' in window) || !videoRef.current) return undefined

    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 })
    let cancelled = false

    const analyzeFrame = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return
      try {
        const faces = await detector.detect(videoRef.current)
        if (!faces?.length) {
          await handleWarning('ai_face_missing', { reason: 'no_face_detected' })
          return
        }
        if (faces.length > 1) {
          await handleWarning('ai_multiple_faces', { detected_faces: faces.length })
          return
        }

        const box = faces[0].boundingBox
        if (box && videoRef.current.videoHeight) {
          const faceMidY = box.y + box.height / 2
          if (faceMidY > videoRef.current.videoHeight * 0.72) {
            await handleWarning('ai_looking_down', {
              face_mid_y: faceMidY,
              frame_height: videoRef.current.videoHeight
            })
          }
        }
      } catch (_err) {
        // Ignore detector errors and keep the quiz session alive.
      }
    }

    const interval = window.setInterval(analyzeFrame, 7000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [attemptState, quiz?.proctoring_enabled, attempt?.id])

  return (
    <ClassroomShell classroom={classroom} activeTab="classwork" isLoading={loading} error={error}>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="card p-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{availabilityLabel}</span>
              {quiz?.proctoring_enabled && <span className="role-pill border-[#a1a1aa] bg-[#f4f4f5] text-[#18181b]">Camera-proctored</span>}
            </div>
            <h2 className="mt-4 text-3xl font-bold text-slate-950">{quiz?.title || 'Classroom quiz'}</h2>
            {quiz?.description && <p className="mt-3 text-sm leading-7 text-slate-600">{quiz.description}</p>}

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Questions</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{quiz?.num_questions || 0}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Duration</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{quiz?.duration_minutes || 0} min</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Material</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{quiz?.document?.title || 'Mixed class material'}</p>
              </div>
            </div>
          </div>

          {!isStudent && (
            <>
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
              <ProctorReviewPanel review={proctorReview} title="AI Proctor Review" />
            </>
          )}

          {isStudent && attemptState === 'idle' && (
            <div className="card p-8">
              <h3 className="text-2xl font-bold text-slate-950">Ready to begin?</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                You must stay in fullscreen, keep this tab visible, and keep your camera on while the quiz is active. Breaking a proctoring rule ends the quiz automatically.
              </p>
              {attempt?.status === 'submitted' && canBeginQuiz && (
                <div className="mt-4 rounded-xl border border-[#d4d4d8] bg-[#f4f4f5] px-4 py-3 text-[#3f3f46]">
                  Your previous attempt has already been submitted. Because this quiz is still open, you can start a fresh monitored attempt.
                </div>
              )}
              {attempt?.status === 'terminated' && canBeginQuiz && (
                <div className="mt-4 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-800">
                  A previous attempt was terminated. You can start a fresh monitored attempt while this quiz is still open.
                </div>
              )}
              {cameraError && <div className="mt-4 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-800">{cameraError}</div>}
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" onClick={handleStart} disabled={starting || !canBeginQuiz}>
                  {starting ? 'Starting...' : attempt?.status === 'in_progress' ? 'Resume Classroom Quiz' : attempt?.status ? 'Start New Attempt' : 'Start Classroom Quiz'}
                </button>
                <Link href={`/classrooms/${classroomId}/classwork`} className="btn btn-outline">Back to Classwork</Link>
              </div>
            </div>
          )}

          {isStudent && attemptState === 'active' && activeQuestion && (
            <div className="card p-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker text-[#18181b]">Proctored attempt</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">Question {currentIndex + 1} of {questions.length}</h3>
                </div>
                <div className="rounded-full bg-[#e4e4e7] px-4 py-2 font-semibold text-[#3f3f46]">{formatTime(timeRemaining)}</div>
              </div>

              <div className="mb-6 w-full rounded-full bg-zinc-200 h-2">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#c9ab3f] to-[#c9ab3f] transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
              </div>

              <h4 className="text-xl font-bold text-slate-950">{activeQuestion.text}</h4>
              {activeQuestion.source_excerpt && (
                <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-[#f4f4f5] px-4 py-3 text-sm text-[#3f3f46]">
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
                        ? 'border-[#18181b] bg-[#f4f4f5] text-[#18181b]'
                        : 'border-zinc-200 bg-white text-slate-800 hover:border-[#f2e9c4]'
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
              {latestWarning && <div className="mt-5 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-800">{latestWarning}</div>}
            </div>
          )}

          {isStudent && attemptState === 'submitted' && (
            <div className="card p-10 text-center">
              <CheckCircle className="mx-auto h-20 w-20 text-[#18181b]" />
              <h3 className="mt-5 text-3xl font-bold text-slate-950">Quiz submitted</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">Your classroom quiz attempt has been saved. Your educator can now review the result.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href={`/classrooms/${classroomId}/classwork`} className="btn btn-primary">Back to Classwork</Link>
              </div>
            </div>
          )}

          {isStudent && attemptState === 'terminated' && (
            <div className="card p-10 text-center">
              <AlertTriangle className="mx-auto h-20 w-20 text-[#3f3f46]" />
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
            <p className="section-kicker text-[#18181b]">Attempt guard</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Proctoring status</h3>
            <div className="mt-5 space-y-4">
              <div className="surface-quiet flex items-center gap-3 p-4">
                <Shield className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">{quiz?.proctoring_enabled ? 'Protected attempt' : 'Standard attempt'}</p>
                  <p className="text-sm text-slate-600">Fullscreen, visibility, and camera signals are checked while the quiz is live.</p>
                </div>
              </div>
              <div className="surface-quiet p-4">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-[#18181b]" />
                  <div>
                    <p className="font-semibold text-slate-900">Camera preview</p>
                    <p className="text-sm text-slate-600">Students must keep the webcam feed available during a proctored attempt.</p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl bg-[#d9c25c]">
                  <video ref={videoRef} autoPlay muted playsInline className="h-48 w-full object-cover" />
                </div>
              </div>
              {attemptState === 'active' && (
                <div className="surface-subtle p-4 text-sm text-slate-700">
                  <div>{answeredCount} of {questions.length} answered</div>
                  <div className="mt-2 font-semibold text-[#18181b]">{warningCount} of 3 AI warnings used</div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </ClassroomShell>
  )
}

function parseServerDate(value) {
  if (!value || typeof value !== 'string') return null
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
