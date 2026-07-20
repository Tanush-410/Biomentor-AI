import React, { useState, useEffect } from 'react'
import { Brain, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'

import AppShell from '../components/AppShell'
import CircularProgress from '../components/CircularProgress'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

export default function QuizSessionPage() {
  const { token, loading: authLoading } = useAuth()
  const router = useRouter()
  const [quizConfig, setQuizConfig] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }

    const config = sessionStorage.getItem('quizConfig')
    if (!config) {
      router.push('/start-quiz')
      return
    }

    const preGenerated = sessionStorage.getItem('generatedQuestions')
    const parsedConfig = JSON.parse(config)
    setQuizConfig(parsedConfig)
    setTimeRemaining(parsedConfig.duration * 60) // Convert to seconds
    if (preGenerated) {
      try {
        const parsedQuestions = JSON.parse(preGenerated)
        if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
          setQuestions(parsedQuestions)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('Error parsing stored questions:', err)
      }
    }
    loadQuiz(parsedConfig)
  }, [authLoading, token])

  const normalizeQuestions = (payload) => {
    if (Array.isArray(payload)) return payload
    if (payload && Array.isArray(payload.questions)) return payload.questions
    return []
  }

  const loadQuiz = async (config) => {
    try {
      const data = await requestBackendJson('/quiz/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          num_questions: config.numQuestions,
          bloom_level: config.bloomLevel || 3,
          document_ids: config.documentId ? [config.documentId] : [],
          duration_minutes: config.duration
        }
      })
      const normalized = normalizeQuestions(data)
      if (normalized.length > 0) {
        setQuizConfig((current) => ({
          ...(current || config),
          sessionId: data.session_id || current?.sessionId || null
        }))
        setQuestions(normalized)
        return
      } else {
        setQuestions([])
      }
    } catch (err) {
      console.error('Error loading quiz:', err)
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (timeRemaining <= 0 && questions.length > 0 && !submitted) {
      handleSubmitQuiz()
      return
    }

    if (timeRemaining === 0 || !quizConfig || questions.length === 0) return

    const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000)
    return () => clearTimeout(timer)
  }, [timeRemaining, questions, submitted])

  const handleAnswer = (questionId, optionId) => {
    if (submitted) return
    setAnswers({
      ...answers,
      [questionId]: optionId
    })
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmitQuiz = async () => {
    if (submitted) return
    setSubmitted(true)

    let correctCount = 0
    const submittedAnswers = []
    questions.forEach((question) => {
      const selectedOptionId = answers[question.id]
      if (!selectedOptionId) return

      submittedAnswers.push({
        question_id: question.id,
        selected_option_id: selectedOptionId
      })

      const selectedOption = question.options?.find((option) => option.id === selectedOptionId)
      if (selectedOption?.is_correct) {
        correctCount += 1
      }
    })

    const finalScore = Math.round((correctCount / questions.length) * 100)
    setScore(finalScore)

    // Track in backend
    if (!quizConfig?.sessionId) {
      return
    }

    try {
      await requestBackendJson('/quiz/submit-answer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          session_id: quizConfig?.sessionId,
          answers: submittedAnswers,
          total_questions: questions.length
        }
      })
    } catch (err) {
      console.error('Error submitting quiz:', err)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f4f4f5] via-[#f4f4f5] to-[#e4e4e7] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#c9ab3f] mb-4"></div>
          <p className="text-[#52525b]">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <AppShell title="Quiz Complete" description="Your answers have been submitted and the results are now available for progress tracking." contentClassName="max-w-4xl">
          <div className="card p-12 text-center">
            <CheckCircle className="w-24 h-24 text-[#18181b] mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-2">Quiz Submitted!</h2>
            <p className="text-slate-600 mb-8">Your quiz has been submitted and tracked</p>

            <div className="bg-gradient-to-r from-[#f4f4f5] to-[#e4e4e7] p-8 rounded-lg mb-8">
              <p className="text-sm text-slate-600 mb-2">Your Score</p>
              <p className="text-5xl font-bold text-[#27272a]">{score}%</p>
              <p className="text-sm text-slate-600 mt-2">{answers ? Object.keys(answers).length : 0} of {questions.length} answered</p>
            </div>

            <div className="flex gap-4">
              <Link href="/dashboard" className="flex-1 btn btn-primary">
                Back to Dashboard
              </Link>
              <Link href="/start-quiz" className="flex-1 btn btn-outline">
                Take Another Quiz
              </Link>
            </div>
          </div>

          <div className="card p-6 mt-8 bg-[#f4f4f5] border border-[#d4d4d8]">
            <h3 className="font-semibold mb-3">What&apos;s Next?</h3>
            <ul className="text-sm text-slate-700 space-y-2">
              <li>✓ Your score has been recorded for progress tracking</li>
              <li>✓ Review your performance in the Progress page</li>
              <li>✓ Upload more materials to practice with different content</li>
              <li>✓ Ask your educator to use Bloom&apos;s tools for cross-level question conversion</li>
            </ul>
          </div>
      </AppShell>
    )
  }

  if (!quizConfig || questions.length === 0) {
    return (
      <AppShell title="Quiz" description="No usable questions were generated from the current material." contentClassName="max-w-4xl" actions={<Link href="/start-quiz" className="btn btn-outline">Back</Link>}>
          <div className="card p-10 text-center">
            <AlertCircle className="w-16 h-16 text-[#3f3f46] mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No usable quiz questions yet</h2>
            <p className="text-slate-600 mb-6">
              We could not build good questions from the selected material. Try a different document or upload content with more explanatory text.
            </p>
            <Link href="/start-quiz" className="btn btn-primary">Return to Quiz Setup</Link>
          </div>
      </AppShell>
    )
  }

  const currentQuestion = questions[currentIndex]
  const timeWarning = timeRemaining < 300 // Less than 5 minutes
  const answeredCount = Object.keys(answers).length
  const completionPercent = Math.round(((currentIndex + 1) / questions.length) * 100)

  return (
    <AppShell
      title="Quiz Session"
      description={`Question ${currentIndex + 1} of ${questions.length}. Work through the material-grounded questions and submit when you're ready.`}
      contentClassName="max-w-4xl"
      actions={
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2 ${
          timeWarning ? 'bg-[#e4e4e7] text-[#27272a]' : 'bg-[#e4e4e7] text-[#3f3f46]'
        }`}>
          <Clock className="w-5 h-5" />
          <span className="font-semibold">{formatTime(timeRemaining)}</span>
        </div>
      }
    >
        <div className="mb-6 flex justify-end">
          <CircularProgress
            value={completionPercent}
            size={82}
            stroke={8}
            label={`Question ${currentIndex + 1} of ${questions.length}`}
            caption={`${answeredCount} answered`}
            progressClassName="stroke-[#c9ab3f]"
            trackClassName="stroke-[#d4d4d8]"
            tone="text-[#18181b]"
          />
        </div>

        <div className="card p-8 mb-8">
          {/* Question */}
          <h2 className="text-xl font-bold mb-6">{currentQuestion.text}</h2>
          {(currentQuestion.document_reference || currentQuestion.page_number || currentQuestion.bloom_level_name) && (
            <div className="mb-6 flex flex-wrap gap-2 text-sm">
              {currentQuestion.bloom_level_name && (
                <span className="rounded-full bg-[#e4e4e7] px-3 py-1 font-semibold text-[#3f3f46]">
                  {currentQuestion.bloom_level_name}
                </span>
              )}
              {currentQuestion.document_reference && (
                <span className="rounded-full bg-[#e4e4e7] px-3 py-1 font-semibold text-[#3f3f46]">
                  {currentQuestion.document_reference}
                </span>
              )}
              {currentQuestion.page_number && (
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                  Page {currentQuestion.page_number}
                </span>
              )}
              {currentQuestion.document_id && (
                <Link
                  href={`/document/${currentQuestion.document_id}?page=${currentQuestion.page_number || 1}`}
                  className="rounded-full border border-[#d4d4d8] bg-white px-3 py-1 font-semibold text-[#27272a] transition hover:bg-[#f4f4f5]"
                >
                  Open source page
                </Link>
              )}
            </div>
          )}
          {currentQuestion.source_excerpt && (
            <div className="mb-6 rounded-2xl border border-[#d4d4d8] bg-[#f4f4f5] px-4 py-3 text-sm text-[#3f3f46]">
              <p className="font-semibold mb-1">Why this question appears</p>
              <p>{currentQuestion.source_excerpt}</p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3 mb-8">
            {currentQuestion.options && currentQuestion.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleAnswer(currentQuestion.id, option.id)}
                disabled={submitted}
                className={`w-full p-4 text-left rounded-lg border-2 transition ${
                  answers[currentQuestion.id] === option.id
                    ? 'border-[#c9ab3f] bg-[#f4f4f5]'
                    : 'border-[#d4d4d8] hover:border-[#c9ab3f] bg-[#fafafa]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    answers[currentQuestion.id] === option.id
                      ? 'border-[#c9ab3f] bg-[#c9ab3f]'
                      : 'border-[#d4d4d8]'
                  }`}>
                    {answers[currentQuestion.id] === option.id && (
                      <span className="text-zinc-950 text-sm">✓</span>
                    )}
                  </div>
                  <span>{option.id}. {option.text}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-6 py-3 bg-[#e4e4e7] hover:bg-[#d4d4d8] disabled:bg-[#f4f4f5] disabled:text-[#a1a1aa] text-[#27272a] font-semibold rounded-lg transition"
            >
              ← Previous
            </button>
            
            {currentIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                className="flex-1 bg-[#c9ab3f] hover:bg-[#a88a26] text-zinc-950 font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Submit Quiz
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 bg-[#c9ab3f] hover:bg-[#a88a26] text-zinc-950 font-semibold py-3 rounded-lg transition"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Question Navigator */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Questions ({Object.keys(answers).length} answered)</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`aspect-square rounded font-semibold transition ${
                  idx === currentIndex
                    ? 'bg-[#c9ab3f] text-zinc-950'
                    : answers[questions[idx].id]
                    ? 'bg-[#e4e4e7] text-[#3f3f46]'
                    : 'bg-[#e4e4e7] text-[#3f3f46] hover:bg-[#d4d4d8]'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
    </AppShell>
  )
}
