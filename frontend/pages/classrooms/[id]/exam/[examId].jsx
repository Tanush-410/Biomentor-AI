import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Camera, CheckCircle, Clock3, FileImage, Shield } from 'lucide-react'
import { useRouter } from 'next/router'

import ClassroomShell from '../../../../components/ClassroomShell'
import { useAuth } from '../../../../context/AuthContext'
import {
  getClassroom,
  getClassroomExam,
  heartbeatClassroomExamAttempt,
  reportClassroomExamWarning,
  reportClassroomExamViolation,
  startClassroomExamAttempt,
  submitClassroomExamAttempt
} from '../../../../lib/classroomApi'

function parseServerDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getInitialAnswerState(questions = []) {
  return questions.reduce((accumulator, question) => {
    accumulator[question.id] = {
      typed_answer: '',
      uploaded_image_urls: [],
      selected_option_ids: []
    }
    return accumulator
  }, {})
}

export default function ClassroomExamPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [exam, setExam] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [attemptState, setAttemptState] = useState('idle')
  const [warningCount, setWarningCount] = useState(0)
  const [latestWarning, setLatestWarning] = useState('')
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const violationSentRef = useRef(false)
  const warningTimestampsRef = useRef({})
  const restoredDraftKeyRef = useRef('')

  const classroomId = typeof router.query.id === 'string' ? router.query.id : ''
  const examId = typeof router.query.examId === 'string' ? router.query.examId : ''
  const isStudent = user?.role === 'student'
  const isEducator = ['educator', 'admin'].includes(user?.role)
  const draftStorageKey = useMemo(
    () => (user?.id && examId ? `classroom-exam-draft:${user.id}:${examId}` : ''),
    [user?.id, examId]
  )

  const orderedQuestions = useMemo(() => exam?.questions || [], [exam?.questions])
  const totalAnswered = useMemo(
    () => Object.values(answers).filter((value) => value?.typed_answer?.trim() || value?.uploaded_image_urls?.length || value?.selected_option_ids?.length).length,
    [answers]
  )

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!classroomId || !examId) return
    loadPage()
  }, [authLoading, token, router.isReady, classroomId, examId])

  useEffect(() => () => stopCamera(), [])

  useEffect(() => {
    if (attemptState !== 'active' || !attempt || !exam) return undefined

    const tick = () => {
      const now = Date.now()
      const startedAt = parseServerDate(attempt.started_at)?.getTime() || now
      const durationEnd = startedAt + (exam.duration_minutes || 60) * 60 * 1000
      const hardClose = parseServerDate(exam.available_until)?.getTime() || durationEnd
      const remaining = Math.max(0, Math.floor((Math.min(durationEnd, hardClose) - now) / 1000))
      setTimeRemaining(remaining)
      if (remaining === 0) {
        handleSubmit()
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [attemptState, attempt, exam])

  useEffect(() => {
    if (attemptState !== 'active' || !exam?.proctoring_enabled || !attempt?.id) return undefined

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

    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [attemptState, exam?.proctoring_enabled, attempt?.id])

  useEffect(() => {
    if (attemptState !== 'active' || !attempt?.id) return undefined

    const heartbeat = async () => {
      try {
        const payload = await heartbeatClassroomExamAttempt(token, classroomId, examId, {
          attempt_id: attempt.id
        })
        if (payload?.attempt) {
          setAttempt((current) => ({ ...(current || {}), ...payload.attempt }))
        }
      } catch (_error) {
        // Keep the attempt running unless a real violation closes it.
      }
    }

    heartbeat()
    const interval = window.setInterval(heartbeat, 15000)
    return () => window.clearInterval(interval)
  }, [attemptState, attempt?.id, token, classroomId, examId])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey) return
    if (attemptState === 'submitted' || attemptState === 'terminated') {
      window.localStorage.removeItem(draftStorageKey)
      restoredDraftKeyRef.current = ''
    }
  }, [draftStorageKey, attemptState])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey || attemptState !== 'active' || !orderedQuestions.length) return
    if (restoredDraftKeyRef.current === draftStorageKey) return

    try {
      const raw = window.localStorage.getItem(draftStorageKey)
      if (!raw) {
        restoredDraftKeyRef.current = draftStorageKey
        return
      }
      const savedAnswers = JSON.parse(raw)
      if (!savedAnswers || typeof savedAnswers !== 'object') {
        restoredDraftKeyRef.current = draftStorageKey
        return
      }
      setAnswers((current) => {
        const hydrated = { ...current }
        orderedQuestions.forEach((question) => {
          const saved = savedAnswers[question.id] || {}
          hydrated[question.id] = {
            ...(current[question.id] || {
              typed_answer: '',
              uploaded_image_urls: [],
              selected_option_ids: []
            }),
            typed_answer: typeof saved.typed_answer === 'string' ? saved.typed_answer : current[question.id]?.typed_answer || '',
            uploaded_image_urls: Array.isArray(saved.uploaded_image_urls) ? saved.uploaded_image_urls : current[question.id]?.uploaded_image_urls || [],
            selected_option_ids: Array.isArray(saved.selected_option_ids) ? saved.selected_option_ids : current[question.id]?.selected_option_ids || []
          }
        })
        return hydrated
      })
    } catch (_error) {
      // Ignore malformed local drafts so the active attempt can still continue.
    } finally {
      restoredDraftKeyRef.current = draftStorageKey
    }
  }, [draftStorageKey, attemptState, orderedQuestions])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey || attemptState !== 'active' || !orderedQuestions.length) return

    const payload = orderedQuestions.reduce((accumulator, question) => {
      accumulator[question.id] = {
        typed_answer: answers[question.id]?.typed_answer || '',
        uploaded_image_urls: answers[question.id]?.uploaded_image_urls || [],
        selected_option_ids: answers[question.id]?.selected_option_ids || []
      }
      return accumulator
    }, {})

    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload))
  }, [draftStorageKey, attemptState, orderedQuestions, answers])

  const loadPage = async () => {
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, examPayload] = await Promise.all([
        getClassroom(token, classroomId),
        getClassroomExam(token, classroomId, examId)
      ])
      setClassroom(classroomPayload.classroom)
      setExam(examPayload.exam)
      setAttempt(examPayload.exam?.attempt || null)
      setAnswers(getInitialAnswerState(examPayload.exam?.questions || []))
      const latestAttempt = examPayload.exam?.attempt || null
      setWarningCount(latestAttempt?.violation_count || 0)
      if (latestAttempt?.status === 'submitted') {
        setAttemptState('submitted')
      } else if (latestAttempt?.status === 'terminated') {
        setAttemptState('terminated')
      } else if (latestAttempt?.status === 'in_progress') {
        setAttemptState('active')
      } else {
        setAttemptState('idle')
      }
    } catch (err) {
      setError(err.message || 'Could not load classroom exam.')
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

  const clearLocalDraft = () => {
    if (typeof window === 'undefined' || !draftStorageKey) return
    window.localStorage.removeItem(draftStorageKey)
    restoredDraftKeyRef.current = ''
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
    if (!exam?.proctoring_enabled) return
    setCameraError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        await waitForEvidenceVideoFrame(videoRef.current, 3000)
      }
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => handleViolation('camera_lost', { label: track.label || 'camera' })
      })
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => handleWarning('microphone_lost', { label: track.label || 'microphone' })
      })
    } catch (err) {
      setCameraError('Camera and microphone access are required for this protected exam.')
      throw err
    }

    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen()
      } catch (_error) {
        setCameraError('Fullscreen could not be enabled. Allow fullscreen before starting this exam.')
        throw _error
      }
    }
  }

  const handleStart = async () => {
    setStarting(true)
    setError('')
    try {
      await ensureCameraAndFullscreen()
      const payload = await startClassroomExamAttempt(token, classroomId, examId)
      violationSentRef.current = false
      warningTimestampsRef.current = {}
      setLatestWarning('')
      setExam(payload.exam || exam)
      setAttempt(payload.attempt)
      setWarningCount(payload.attempt?.violation_count || 0)
      setAttemptState(payload.attempt?.status === 'in_progress' ? 'active' : payload.attempt?.status || 'idle')
      setAnswers((current) => Object.keys(current).length ? current : getInitialAnswerState(payload.exam?.questions || exam?.questions || []))
    } catch (err) {
      setError(err.message || 'Could not start classroom exam.')
    } finally {
      setStarting(false)
    }
  }

  const handleWarning = async (type, details = {}) => {
    if (!isStudent || !attempt?.id || attemptState !== 'active' || violationSentRef.current) return
    const now = Date.now()
    const lastSeenAt = warningTimestampsRef.current[type] || 0
    if (now - lastSeenAt < 15000) return
    warningTimestampsRef.current[type] = now

    try {
      const evidenceDetails = await buildEvidenceDetails(type, details, warningCount + 1)
      const payload = await reportClassroomExamWarning(token, classroomId, examId, {
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
        setLatestWarning('Repeated anti-cheat warnings ended this exam automatically. The educator must now review the case.')
        setError('This exam was ended automatically after repeated anti-cheat warnings.')
        setAttemptState('terminated')
        clearLocalDraft()
        stopCamera()
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
        return
      }

      const warningMessages = {
        tab_hidden: 'Anti-cheat warning: do not leave the exam tab during a protected attempt.',
        window_blur: 'Anti-cheat warning: stay focused on the exam window.',
        fullscreen_exit: 'Anti-cheat warning: fullscreen must stay active for this protected exam.',
        camera_lost: 'Anti-cheat warning: your camera or microphone feed was interrupted.',
        ai_multiple_faces: 'AI warning: more than one face was detected in the frame.',
        ai_face_missing: 'AI warning: your face is not clearly visible to the camera.',
        ai_looking_down: 'AI warning: possible off-screen or phone glance detected.'
      }
      setLatestWarning(warningMessages[type] || 'Protected exam warning recorded.')
    } catch (_error) {
      // Keep the attempt active if a warning could not be saved remotely.
    }
  }

  const handleViolation = async (type, details = {}) => {
    if (!isStudent || !attempt?.id || violationSentRef.current) return
    violationSentRef.current = true
    try {
      const evidenceDetails = await buildEvidenceDetails(type, details, warningCount + 1)
      const payload = await reportClassroomExamViolation(token, classroomId, examId, {
        attempt_id: attempt.id,
        violation_type: type,
        details: evidenceDetails
      })
      clearLocalDraft()
      stopCamera()
      setAttempt(payload.attempt)
      setAttemptState('terminated')
      setError('This exam was ended automatically because a proctoring rule was broken. The case has been sent for educator review.')
    } catch (err) {
      setError(err.message || 'The exam could not continue after a proctoring event.')
    } finally {
      stopCamera()
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  const updateTypedAnswer = (questionId, value) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || {}),
        typed_answer: value
      }
    }))
  }

  const updateSelectedOption = (questionId, optionId) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || {}),
        selected_option_ids: [optionId]
      }
    }))
  }

  const updateUploadedImages = async (questionId, fileList) => {
    const files = Array.from(fileList || [])
    const encoded = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
      )
    )
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || {}),
        uploaded_image_urls: encoded
      }
    }))
  }

  const handleSubmit = async () => {
    if (!attempt?.id) return
    setSubmitting(true)
    setError('')
    violationSentRef.current = true
    try {
      const payload = await submitClassroomExamAttempt(token, classroomId, examId, {
        attempt_id: attempt.id,
        responses: orderedQuestions.map((question) => ({
          question_id: question.id,
          typed_answer: answers[question.id]?.typed_answer || '',
          uploaded_image_urls: answers[question.id]?.uploaded_image_urls || [],
          selected_option_ids: answers[question.id]?.selected_option_ids || [],
          metadata: {
            response_mode: question.response_mode
          }
        }))
      })
      clearLocalDraft()
      stopCamera()
      setAttempt(payload.attempt)
      setAttemptState('submitted')
    } catch (err) {
      violationSentRef.current = false
      setError(err.message || 'Could not submit classroom exam.')
    } finally {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (attemptState !== 'active' || !exam?.proctoring_enabled || !attempt?.id) return undefined
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
      } catch (_error) {
        // Ignore detector errors so browser support does not break the exam.
      }
    }

    const interval = window.setInterval(analyzeFrame, 7000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [attemptState, exam?.proctoring_enabled, attempt?.id])

  return (
    <ClassroomShell classroom={classroom} activeTab="classwork" isLoading={loading} error={error}>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="section-kicker text-[#18181b]">Classroom exam</p>
                <h1 className="mt-2 text-4xl font-bold text-slate-950">{exam?.title || 'Exam workspace'}</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">{exam?.description || exam?.instructions || 'Open the scheduled exam, answer each question in the fixed response area, and submit before the timer closes.'}</p>
              </div>
              <div className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Attempt status</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{attemptState === 'active' ? 'Live' : attemptState === 'submitted' ? 'Submitted' : attemptState === 'terminated' ? 'Ended' : 'Ready'}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{exam?.exam_mode || 'mixed'}</span>
              <span>{exam?.questions?.length || 0} questions</span>
              <span>{exam?.duration_minutes || 60} min</span>
              <span>{exam?.total_marks || 0} marks</span>
              {exam?.proctoring_enabled && <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-[#18181b]" />Protected attempt</span>}
            </div>
          </div>

          {isEducator && (
            <div className="card p-6">
              <p className="section-kicker text-[#18181b]">Educator view</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Authored exam detail</h2>
              <div className="mt-5 space-y-4">
                {(orderedQuestions || []).map((question, index) => (
                  <div key={question.id} className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Question {index + 1}</p>
                    <h3 className="mt-3 text-xl font-bold text-slate-950">{question.prompt}</h3>
                    <p className="mt-3 text-sm text-slate-600">Response mode: {question.response_mode} · Marks: {question.marks}</p>
                    {(question.grading_keywords || []).length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {question.grading_keywords.map((keyword) => (
                          <span key={keyword} className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{keyword}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isStudent && (
            <div className="card p-6">
              {attemptState === 'idle' && (
                <div className="space-y-5">
                  <p className="text-sm leading-7 text-slate-600">
                    This exam uses fixed response boxes. If proctoring is enabled, keep your camera and microphone on, stay in fullscreen, and avoid leaving the tab.
                  </p>
                  <button onClick={handleStart} disabled={starting} className="btn btn-primary">
                    {starting ? 'Starting exam...' : 'Start Classroom Exam'}
                  </button>
                </div>
              )}

              {attemptState === 'active' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Clock3 className="h-4 w-4 text-[#18181b]" />
                      Time remaining: {Math.floor(timeRemaining / 60)}m {String(timeRemaining % 60).padStart(2, '0')}s
                    </div>
                    <div className="text-sm text-slate-600">{totalAnswered}/{orderedQuestions.length} answered · {warningCount}/3 warnings</div>
                  </div>

                  {latestWarning && (
                    <div className="rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-800">
                      {latestWarning}
                    </div>
                  )}

                  <div className="space-y-5">
                    {orderedQuestions.map((question, index) => (
                      <div key={question.id} className="rounded-[28px] border border-[#d4d4d8] bg-white p-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">Question {index + 1}</span>
                          <span className="text-sm text-slate-600">{question.marks} marks</span>
                          <span className="text-sm text-slate-600">{question.response_mode}</span>
                        </div>
                        <h3 className="mt-4 text-xl font-bold text-slate-950">{question.prompt}</h3>

                        {question.question_type === 'mcq' ? (
                          <div className="mt-4 space-y-3">
                            {(question.options || []).map((option) => (
                              <label key={option.id} className="flex items-center gap-3 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3">
                                <input
                                  type="radio"
                                  name={`question-${question.id}`}
                                  checked={(answers[question.id]?.selected_option_ids || [])[0] === option.id}
                                  onChange={() => updateSelectedOption(question.id, option.id)}
                                />
                                <span className="text-sm text-slate-700">{option.text}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 space-y-4">
                            {question.response_mode !== 'image_upload' && (
                              <textarea
                                value={answers[question.id]?.typed_answer || ''}
                                onChange={(event) => updateTypedAnswer(question.id, event.target.value)}
                                rows={question.response_config?.rows || 6}
                                className="input min-h-[160px]"
                                placeholder={question.response_config?.placeholder || 'Write your answer here.'}
                              />
                            )}
                            {question.response_mode !== 'typed' && (
                              <label className="block rounded-2xl border border-dashed border-[#d4d4d8] bg-[#fafafa] p-4">
                                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#18181b]">
                                  <FileImage className="h-4 w-4" />
                                  Upload handwritten or diagram response
                                </div>
                                <input type="file" accept="image/*" multiple onChange={(event) => updateUploadedImages(question.id, event.target.files)} className="mt-3 block w-full text-sm text-slate-600" />
                                {(answers[question.id]?.uploaded_image_urls || []).length > 0 && (
                                  <p className="mt-3 text-sm text-slate-600">{answers[question.id].uploaded_image_urls.length} response image(s) attached.</p>
                                )}
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">
                    {submitting ? 'Submitting exam...' : 'Submit Exam'}
                  </button>
                </div>
              )}

              {attemptState === 'submitted' && (
                <div className="space-y-5 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-950">Exam submitted</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Objective and descriptive scoring have been captured. If educator review is required, the educator will validate the final result before publishing it.
                    </p>
                  </div>
                </div>
              )}

              {attemptState === 'terminated' && (
                <div className="space-y-5 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-zinc-900">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-950">Attempt ended for review</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      A proctoring rule was broken, so this protected attempt ended automatically and has been sent to the educator for review in the anti-cheat bot.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Attempt guard</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Camera preview</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Protected exams keep the camera and microphone open while the attempt is active. Leaving fullscreen or the tab ends the attempt automatically.
            </p>
            <div className="mt-5 overflow-hidden rounded-[28px] border border-[#d4d4d8] bg-[#d9c25c]">
              <video ref={videoRef} autoPlay muted playsInline className="h-[260px] w-full object-cover" />
            </div>
            {cameraError && <div className="mt-4 rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-900">{cameraError}</div>}
            {exam?.proctoring_enabled && (
              <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-sm text-slate-600">
                Anti-cheat warnings recorded: <span className="font-semibold text-slate-900">{warningCount}</span> / 3
              </div>
            )}
          </div>

          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Answer mode</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Fixed response boxes</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">Educators choose the response mode per question.</div>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">Descriptive answers stay inside fixed boxes for cleaner grading review.</div>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">Image answers can be attached for handwritten work or diagrams.</div>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">While the attempt stays active, typed and selected answers autosave locally on this device.</div>
            </div>
          </div>

          <div className="card p-6">
            <Link href="/educator/anticheat-bot" className="btn btn-outline w-full text-center">Open Anticheat Bot</Link>
          </div>
        </aside>
      </section>
    </ClassroomShell>
  )
}
