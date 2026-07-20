import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Camera, Clock3, FileQuestion, ListChecks, PencilLine, Plus, School, Trash2 } from 'lucide-react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import AISpotlightBanner from '../../components/AISpotlightBanner'
import QuizQualityPanel from '../../components/QuizQualityPanel'
import { useAuth } from '../../context/AuthContext'
import { normalizeListPayload, requestBackendJson } from '../../lib/backendApi'
import { createClassroomQuiz, listClassrooms, listDocuments } from '../../lib/classroomApi'

const BLOOM_LEVELS = [
  { value: '', label: 'Mixed Bloom levels' },
  { value: '1', label: 'Remember' },
  { value: '2', label: 'Understand' },
  { value: '3', label: 'Apply' },
  { value: '4', label: 'Analyze' },
  { value: '5', label: 'Evaluate' },
  { value: '6', label: 'Create' }
]

const MANUAL_OPTION_IDS = ['A', 'B', 'C', 'D']

function buildManualQuestion(index = 0) {
  return {
    local_id: `manual-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: '',
    explanation: '',
    bloom_level: '3',
    correct_option_id: 'A',
    options: MANUAL_OPTION_IDS.map((id) => ({ id, text: '' }))
  }
}

export default function EducatorQuizMakerPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classrooms, setClassrooms] = useState([])
  const [documents, setDocuments] = useState([])
  const [saving, setSaving] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [success, setSuccess] = useState(null)
  const [qualityReview, setQualityReview] = useState(null)
  const [form, setForm] = useState({
    classroom_id: '',
    title: '',
    description: '',
    document_id: '',
    quiz_mode: 'generated',
    bloom_level: '',
    num_questions: 5,
    duration_minutes: 15,
    available_from: '',
    available_until: '',
    publish_to_stream: true,
    proctoring_enabled: true,
    allow_late_entries: false,
    manual_questions: [buildManualQuestion(1)]
  })

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => item.id === form.classroom_id),
    [classrooms, form.classroom_id]
  )

  const authoredQuestionCount = form.manual_questions.length
  const manualQuizReady = useMemo(
    () =>
      form.manual_questions.every((question) =>
        question.prompt.trim() &&
        question.options.every((option) => option.text.trim()) &&
        question.correct_option_id
      ),
    [form.manual_questions]
  )

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!['educator', 'admin'].includes(user?.role)) {
      router.push('/dashboard')
      return
    }
    loadData()
  }, [authLoading, token, user?.role])

  const loadData = async () => {
    setError('')
    try {
      const [classroomPayload, documentPayload] = await Promise.all([
        listClassrooms(token),
        listDocuments(token)
      ])
      const classroomList = normalizeListPayload(classroomPayload, 'classrooms')
      const documentList = normalizeListPayload(documentPayload, 'documents')
      setClassrooms(classroomList)
      setDocuments(documentList)
      setForm((current) => ({
        ...current,
        classroom_id: current.classroom_id || classroomList?.[0]?.id || '',
        document_id: current.document_id || documentList?.[0]?.id || ''
      }))
    } catch (err) {
      setError(err.message || 'Could not load classrooms and materials.')
    }
  }

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateManualQuestion = (localId, patch) => {
    setForm((current) => ({
      ...current,
      manual_questions: current.manual_questions.map((question) =>
        question.local_id === localId ? { ...question, ...patch } : question
      )
    }))
  }

  const updateManualOption = (localId, optionId, value) => {
    setForm((current) => ({
      ...current,
      manual_questions: current.manual_questions.map((question) => {
        if (question.local_id !== localId) return question
        return {
          ...question,
          options: question.options.map((option) => (option.id === optionId ? { ...option, text: value } : option))
        }
      })
    }))
  }

  const addManualQuestion = () => {
    setForm((current) => ({
      ...current,
      manual_questions: [...current.manual_questions, buildManualQuestion(current.manual_questions.length + 1)]
    }))
  }

  const removeManualQuestion = (localId) => {
    setForm((current) => {
      if (current.manual_questions.length === 1) return current
      return {
        ...current,
        manual_questions: current.manual_questions.filter((question) => question.local_id !== localId)
      }
    })
  }

  const resetSuccessfulFields = () => {
    setForm((current) => ({
      ...current,
      title: '',
      description: '',
      available_from: '',
      available_until: '',
      manual_questions: current.quiz_mode === 'manual' ? [buildManualQuestion(1)] : current.manual_questions
    }))
    setQualityReview(null)
  }

  const buildReviewPayload = () => ({
    title: form.title,
    description: form.description || null,
    document_id: form.document_id || null,
    quiz_mode: form.quiz_mode,
    bloom_level: form.quiz_mode === 'generated' && form.bloom_level ? Number(form.bloom_level) : null,
    num_questions: form.quiz_mode === 'generated' ? Number(form.num_questions) : authoredQuestionCount,
    duration_minutes: Number(form.duration_minutes),
    available_from: form.available_from ? new Date(form.available_from).toISOString() : null,
    available_until: form.available_until ? new Date(form.available_until).toISOString() : null,
    publish_to_stream: form.publish_to_stream,
    proctoring_enabled: form.proctoring_enabled,
    allow_late_entries: form.allow_late_entries,
    manual_questions:
      form.quiz_mode === 'manual'
        ? form.manual_questions.map((question) => ({
            prompt: question.prompt,
            explanation: question.explanation || null,
            bloom_level: Number(question.bloom_level || 3),
            correct_option_id: question.correct_option_id,
            options: question.options.map((option) => ({ id: option.id, text: option.text }))
          }))
        : null
  })

  const handleReview = async () => {
    setReviewing(true)
    setReviewError('')
    try {
      const payload = await requestBackendJson('/educator/quiz-quality/review', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: buildReviewPayload()
      })
      setQualityReview(payload)
    } catch (err) {
      setReviewError(err.message || 'Could not review quiz quality.')
    } finally {
      setReviewing(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.classroom_id) {
      setError('Choose a classroom before publishing the quiz.')
      return
    }
    if (form.quiz_mode === 'generated' && !form.document_id) {
      setError('Generated quizzes need a linked study material.')
      return
    }
    if (form.quiz_mode === 'manual' && !manualQuizReady) {
      setError('Complete every manual question, option, and answer key before publishing.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(null)

    try {
      const response = await createClassroomQuiz(token, form.classroom_id, buildReviewPayload())
      setSuccess(response.quiz)
      resetSuccessfulFields()
    } catch (err) {
      setError(err.message || 'Could not publish classroom quiz.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell
      title="Quiz Maker"
      eyebrow="Educator workflow"
      description="Switch between AI-generated classroom quizzes and fully manual authoring, then publish with schedule, proctoring, and autograding built in."
      actions={
        <>
          <Link href="/classrooms" className="btn btn-outline">Open Classrooms</Link>
          <Link href="/dashboard" className="btn btn-outline">Back to Dashboard</Link>
        </>
      }
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}
      {success && (
        <div className="rounded-2xl border border-zinc-300 bg-zinc-100 px-5 py-4 text-zinc-900">
          <p className="font-semibold">Quiz published to {selectedClassroom?.name || 'your classroom'}.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/classrooms/${success.classroom_id || form.classroom_id}/classwork`} className="btn btn-outline">Open Classwork</Link>
            <Link href={`/classrooms/${success.classroom_id || form.classroom_id}/quiz/${success.id}`} className="btn btn-primary">Open Quiz</Link>
          </div>
        </div>
      )}

      <AISpotlightBanner
        eyebrow="Assessment AI Surface"
        title="Assessment Intelligence Studio"
        description="Design, review, schedule, and harden classroom quizzes from one visible AI assessment workspace. The quality layer now checks what the quiz is really measuring before you release it."
        highlights={['Quality review', 'Bloom coverage', 'Release risk']}
        primaryAction={{ label: 'Open Assessment Review', href: '#assessment-release-gate' }}
        secondaryAction={{ label: 'Jump to Authoring Form', href: '#quiz-authoring-studio' }}
        status="Use this studio before publishing any classroom quiz so the assessment feels intentional, defensible, and aligned with the material it came from."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <form id="quiz-authoring-studio" onSubmit={handleSubmit} className="card p-8 space-y-6">
          <div>
            <p className="section-kicker text-[#18181b]">Authoring studio</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Build classroom quizzes your way, then release them on schedule.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Educators can still generate quizzes from study material, but now manual authoring is first-class too. Enter the questions, define the answer key, and the backend will autograde the attempt after students submit.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => updateForm('quiz_mode', 'generated')}
              className={`rounded-2xl border p-5 text-left transition ${form.quiz_mode === 'generated' ? 'border-[#c9ab3f] bg-[#f4f4f5] shadow-sm' : 'border-slate-200 bg-white hover:border-[#d4d4d8]'}`}
            >
              <div className="flex items-center gap-3">
                <ListChecks className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">Generate from Material</p>
                  <p className="text-sm text-slate-600">Use your uploaded study content and Bloom settings to assemble the quiz automatically.</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => updateForm('quiz_mode', 'manual')}
              className={`rounded-2xl border p-5 text-left transition ${form.quiz_mode === 'manual' ? 'border-[#c9ab3f] bg-[#f4f4f5] shadow-sm' : 'border-slate-200 bg-white hover:border-[#d4d4d8]'}`}
            >
              <div className="flex items-center gap-3">
                <PencilLine className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">Build Manually</p>
                  <p className="text-sm text-slate-600">Enter each question, all answer options, and the answer key so student attempts autograde instantly.</p>
                </div>
              </div>
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">Classroom</span>
              <select value={form.classroom_id} onChange={(event) => updateForm('classroom_id', event.target.value)} className="input" required>
                <option value="">Select classroom</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">
                {form.quiz_mode === 'generated' ? 'Linked material' : 'Optional linked material'}
              </span>
              <select value={form.document_id} onChange={(event) => updateForm('document_id', event.target.value)} className="input">
                <option value="">{form.quiz_mode === 'generated' ? 'Select material' : 'No linked material'}</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>{document.title}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-800">Quiz title</span>
              <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} className="input" placeholder="Midterm OS Proctored Quiz" required />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-800">Instructions for students</span>
              <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} className="input min-h-[140px]" placeholder="Tell students what the quiz covers, what is allowed, and how the session will be proctored." />
            </label>
          </div>

          {form.quiz_mode === 'generated' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">Bloom level</span>
                <select value={form.bloom_level} onChange={(event) => updateForm('bloom_level', event.target.value)} className="input">
                  {BLOOM_LEVELS.map((level) => (
                    <option key={level.label} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">Questions</span>
                <input type="number" min="3" max="25" value={form.num_questions} onChange={(event) => updateForm('num_questions', event.target.value)} className="input" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">Duration (minutes)</span>
                <input type="number" min="5" max="180" value={form.duration_minutes} onChange={(event) => updateForm('duration_minutes', event.target.value)} className="input" />
              </label>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18181b]">Manual quiz authoring</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">Enter the exact questions, options, and answer key.</h3>
                </div>
                <button type="button" onClick={addManualQuestion} className="btn btn-outline inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add question
                </button>
              </div>

              {form.manual_questions.map((question, index) => (
                <div key={question.local_id} className="rounded-3xl border border-[#e8d8c8] bg-[#fafafa] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18181b]">Question {index + 1}</p>
                      <p className="mt-1 text-sm text-slate-600">This question will be stored exactly as authored and autograded from the selected answer key.</p>
                    </div>
                    {form.manual_questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeManualQuestion(question.local_id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e2cdb7] bg-white text-[#18181b] transition hover:bg-[#f4f4f5]"
                        aria-label={`Remove question ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-5 grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-800">Question prompt</span>
                      <textarea
                        value={question.prompt}
                        onChange={(event) => updateManualQuestion(question.local_id, { prompt: event.target.value })}
                        className="input min-h-[110px]"
                        placeholder="Enter the question exactly as students should see it."
                        required
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      {question.options.map((option) => (
                        <label key={option.id} className="space-y-2">
                          <span className="text-sm font-semibold text-slate-800">Option {option.id}</span>
                          <input
                            value={option.text}
                            onChange={(event) => updateManualOption(question.local_id, option.id, event.target.value)}
                            className="input"
                            placeholder={`Enter option ${option.id}`}
                            required
                          />
                        </label>
                      ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-800">Correct answer</span>
                        <select
                          value={question.correct_option_id}
                          onChange={(event) => updateManualQuestion(question.local_id, { correct_option_id: event.target.value })}
                          className="input"
                        >
                          {MANUAL_OPTION_IDS.map((optionId) => (
                            <option key={optionId} value={optionId}>Option {optionId}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-800">Bloom level</span>
                        <select
                          value={question.bloom_level}
                          onChange={(event) => updateManualQuestion(question.local_id, { bloom_level: event.target.value })}
                          className="input"
                        >
                          {BLOOM_LEVELS.slice(1).map((level) => (
                            <option key={level.value} value={level.value}>{level.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-800">Explanation for review</span>
                      <textarea
                        value={question.explanation}
                        onChange={(event) => updateManualQuestion(question.local_id, { explanation: event.target.value })}
                        className="input min-h-[90px]"
                        placeholder="Optional explanation shown for internal grading context and future review flows."
                      />
                    </label>
                  </div>
                </div>
              ))}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-800">Duration (minutes)</span>
                  <input type="number" min="5" max="180" value={form.duration_minutes} onChange={(event) => updateForm('duration_minutes', event.target.value)} className="input" />
                </label>
                <div className="surface-quiet flex items-center gap-3 p-4">
                  <FileQuestion className="h-5 w-5 text-[#18181b]" />
                  <div>
                    <p className="font-semibold text-slate-900">{authoredQuestionCount} authored questions</p>
                    <p className="text-sm text-slate-600">The student quiz will use these exact prompts, options, and answer keys.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">Available from</span>
              <input type="datetime-local" value={form.available_from} onChange={(event) => updateForm('available_from', event.target.value)} className="input" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">Available until</span>
              <input type="datetime-local" value={form.available_until} onChange={(event) => updateForm('available_until', event.target.value)} className="input" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="surface-quiet flex items-start gap-3 p-4">
              <input type="checkbox" checked={form.publish_to_stream} onChange={(event) => updateForm('publish_to_stream', event.target.checked)} className="mt-1" />
              <span>
                <span className="block font-semibold text-slate-900">Post to stream</span>
                <span className="text-sm text-slate-600">Announce the quiz publicly in the classroom stream.</span>
              </span>
            </label>
            <label className="surface-quiet flex items-start gap-3 p-4">
              <input type="checkbox" checked={form.proctoring_enabled} onChange={(event) => updateForm('proctoring_enabled', event.target.checked)} className="mt-1" />
              <span>
                <span className="block font-semibold text-slate-900">Require proctoring</span>
                <span className="text-sm text-slate-600">Camera, fullscreen, and tab monitoring stay on during attempts.</span>
              </span>
            </label>
            <label className="surface-quiet flex items-start gap-3 p-4">
              <input type="checkbox" checked={form.allow_late_entries} onChange={(event) => updateForm('allow_late_entries', event.target.checked)} className="mt-1" />
              <span>
                <span className="block font-semibold text-slate-900">Allow late entry</span>
                <span className="text-sm text-slate-600">Students can still join if the access window remains open.</span>
              </span>
            </label>
          </div>

          <button type="submit" disabled={saving} className="btn btn-primary w-full">
            {saving ? 'Publishing quiz...' : 'Publish classroom quiz'}
          </button>
        </form>

        <aside className="space-y-6">
          <div id="assessment-release-gate" className="card border-[#d4d4d8] bg-[#fafafa] p-6">
            <p className="section-kicker text-[#18181b]">Assessment release gate</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Use the AI assessment command before you release this quiz.</h3>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              This review does more than catch weak wording. It tells you what the quiz is really measuring, which fixes matter first, and how to turn the results into follow-up teaching action.
            </p>
          </div>
          <QuizQualityPanel review={qualityReview} loading={reviewing} error={reviewError} onReview={handleReview} />
          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Publishing summary</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">{form.title || 'Your quiz summary will appear here'}</h3>
            <div className="mt-5 space-y-4 text-sm text-slate-700">
              <div className="surface-quiet flex items-center gap-3 p-4">
                <School className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">{selectedClassroom?.name || 'Choose a classroom'}</p>
                  <p className="text-slate-600">Students will see this quiz in the classroom classwork view.</p>
                </div>
              </div>
              <div className="surface-quiet flex items-center gap-3 p-4">
                <FileQuestion className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">
                    {form.quiz_mode === 'manual' ? `${authoredQuestionCount} educator-authored questions` : `${form.num_questions} generated questions`}
                  </p>
                  <p className="text-slate-600">
                    {form.quiz_mode === 'manual'
                      ? 'Autograding will use the educator-defined answer key for each question.'
                      : 'Questions will be generated from the linked material and Bloom settings.'}
                  </p>
                </div>
              </div>
              <div className="surface-quiet flex items-center gap-3 p-4">
                <Clock3 className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">{form.duration_minutes} minute attempt window</p>
                  <p className="text-slate-600">Students are auto-timed once they begin.</p>
                </div>
              </div>
              <div className="surface-quiet flex items-center gap-3 p-4">
                <Camera className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">{form.proctoring_enabled ? 'Camera and browser rules on' : 'Proctoring disabled'}</p>
                  <p className="text-slate-600">Leaving fullscreen, hiding the tab, or losing the camera will end a protected quiz.</p>
                </div>
              </div>
              <div className="surface-quiet flex items-center gap-3 p-4">
                <CalendarDays className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="font-semibold text-slate-900">
                    {form.available_from ? new Date(form.available_from).toLocaleString() : 'Available immediately'}
                  </p>
                  <p className="text-slate-600">
                    {form.available_until ? `Closes ${new Date(form.available_until).toLocaleString()}` : 'No close time set yet'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {form.quiz_mode === 'manual' && (
            <div className="card p-6">
              <p className="section-kicker text-[#18181b]">Answer key confidence</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950">Every manual question is graded from your stored answer key.</h3>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                {form.manual_questions.map((question, index) => (
                  <div key={question.local_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">Q{index + 1} • Correct option {question.correct_option_id}</p>
                    <p className="mt-1 line-clamp-3 text-slate-600">{question.prompt || 'Question prompt pending...'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </section>
    </AppShell>
  )
}
