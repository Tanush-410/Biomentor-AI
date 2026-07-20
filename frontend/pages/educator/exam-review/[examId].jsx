import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, FileImage, ShieldCheck, Sparkles } from 'lucide-react'
import { useRouter } from 'next/router'

import AppShell from '../../../components/AppShell'
import AISpotlightBanner from '../../../components/AISpotlightBanner'
import { useAuth } from '../../../context/AuthContext'
import {
  getClassroomExamReviewAttempt,
  getClassroomExamReviewWorkspace,
  submitClassroomExamReview
} from '../../../lib/classroomApi'

export default function EducatorExamReviewPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const classroomId = typeof router.query.classroomId === 'string' ? router.query.classroomId : ''
  const examId = typeof router.query.examId === 'string' ? router.query.examId : ''
  const requestedAttemptId = typeof router.query.attemptId === 'string' ? router.query.attemptId : ''
  const [workspace, setWorkspace] = useState(null)
  const [activeAttempt, setActiveAttempt] = useState(null)
  const [reviewDraft, setReviewDraft] = useState({ overall_feedback: '', responses: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showPendingOnly, setShowPendingOnly] = useState(false)

  const activeAttemptId = activeAttempt?.attempt_id
  const attemptList = workspace?.attempts || []
  const visibleAttemptList = useMemo(
    () => (showPendingOnly ? attemptList.filter((attempt) => attempt.teacher_review_required) : attemptList),
    [attemptList, showPendingOnly]
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
    if (!classroomId || !examId) return
    loadWorkspace()
  }, [authLoading, token, user?.role, classroomId, examId, requestedAttemptId])

  const loadWorkspace = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getClassroomExamReviewWorkspace(token, classroomId, examId)
      setWorkspace(payload)
      const nextAttempt =
        payload.attempts?.find((attempt) => attempt.attempt_id === requestedAttemptId)
        || payload.attempts?.[0]
        || null
      setActiveAttempt(nextAttempt)
      setReviewDraft(buildDraft(nextAttempt))
    } catch (err) {
      setError(err.message || 'Could not load the exam review workspace.')
    } finally {
      setLoading(false)
    }
  }

  const loadAttempt = async (attemptId) => {
    if (!attemptId) return
    setError('')
    try {
      const payload = await getClassroomExamReviewAttempt(token, classroomId, examId, attemptId)
      setActiveAttempt(payload.attempt)
      setReviewDraft(buildDraft(payload.attempt))
    } catch (err) {
      setError(err.message || 'Could not load this exam attempt.')
    }
  }

  const pendingCount = useMemo(
    () => attemptList.filter((attempt) => attempt.teacher_review_required).length,
    [attemptList]
  )

  const currentAttemptIndex = useMemo(
    () => attemptList.findIndex((attempt) => attempt.attempt_id === activeAttemptId),
    [attemptList, activeAttemptId]
  )

  const nextReviewAttempt = currentAttemptIndex >= 0 ? attemptList[currentAttemptIndex + 1] || null : attemptList[1] || null

  const releaseScore = useMemo(() => {
    if (!activeAttempt) return 0
    return activeAttempt.question_reviews.reduce((total, question) => {
      const draft = reviewDraft.responses[question.response_id] || {}
      const numericScore = Number(draft.teacher_score ?? question.teacher_score ?? question.ai_score ?? 0)
      return total + (Number.isFinite(numericScore) ? numericScore : 0)
    }, 0)
  }, [activeAttempt, reviewDraft.responses])

  const questionNavigator = activeAttempt?.question_navigator || []
  const releaseSummary = activeAttempt?.release_summary || {
    release_score: releaseScore,
    pending_review_count: activeAttempt?.pending_review_count || 0,
    questions_in_desk: activeAttempt?.question_reviews?.length || 0,
    release_readiness: activeAttempt?.pending_review_count ? 'teacher_review_required' : 'ready_to_release',
    checklist: [
      {
        id: 'scores-reviewed',
        label: 'Every question has a educator-reviewed or AI-confirmed released score.',
        complete: Boolean(activeAttempt?.question_reviews?.length),
      },
      {
        id: 'pending-cleared',
        label: 'Pending question checks are cleared before final score release.',
        complete: !activeAttempt?.pending_review_count,
      },
      {
        id: 'feedback-ready',
        label: 'Overall educator feedback is ready for the learner release step.',
        complete: Boolean(reviewDraft.overall_feedback?.trim()),
      }
    ]
  }

  const updateResponseDraft = (responseId, patch) => {
    setReviewDraft((current) => ({
      ...current,
      responses: {
        ...current.responses,
        [responseId]: {
          ...(current.responses[responseId] || {}),
          ...patch
        }
      }
    }))
  }

  const handleSaveReview = async () => {
    if (!activeAttemptId) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = await submitClassroomExamReview(token, classroomId, examId, activeAttemptId, {
        overall_feedback: reviewDraft.overall_feedback,
        responses: Object.entries(reviewDraft.responses).map(([responseId, value]) => ({
          response_id: responseId,
          teacher_score: Number(value.teacher_score || 0),
          teacher_feedback: value.teacher_feedback || '',
          review_status: 'teacher_finalized'
        }))
      })
      setActiveAttempt(payload.attempt)
      setReviewDraft(buildDraft(payload.attempt))
      setWorkspace((current) => ({
        ...current,
        attempts: (current?.attempts || []).map((attempt) => (attempt.attempt_id === payload.attempt.attempt_id ? payload.attempt : attempt))
      }))
      setMessage('Educator review saved and final score updated.')
    } catch (err) {
      setError(err.message || 'Could not save educator review.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell
      title="Exam Review"
      eyebrow="Educator grading desk"
      description="Review descriptive classroom exam answers question by question, adjust marks, and finalize the educator score with the AI draft as a guide."
      actions={
        <>
          <Link href="/educator/exam-maker" className="btn btn-outline">Open Exam Maker</Link>
          <Link href="/educator/anticheat-bot" className="btn btn-outline">Open Anticheat Bot</Link>
        </>
      }
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}
      {message && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-700">{message}</div>}

      <AISpotlightBanner
        eyebrow="Educator review surface"
        title="AI suggests. Educator decides."
        description="This workspace turns submitted descriptive exam answers into a real grading desk: AI score, confidence, keywords, student response, educator override, and final release."
        highlights={['Per-question grading control', 'Image answer review', 'Final educator score release']}
        primaryAction={{ label: 'Jump to Attempts', href: '#exam-review-attempts' }}
        secondaryAction={{ label: 'Open Exam Builder', href: '/educator/exam-maker' }}
        status="Educator review now lives in a dedicated surface instead of staying trapped inside a hidden summary object."
      />

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]" id="exam-review-attempts">
        <aside className="space-y-5">
          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Review queue</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">{workspace?.exam?.title || 'Exam review workspace'}</h2>
            <div className="mt-4 grid gap-3">
              <Metric label="Submitted attempts" value={String(attemptList.length)} />
              <Metric label="Needs review" value={String(pendingCount)} />
            </div>
          </div>

          <div className="card p-4">
            {loading ? (
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm text-slate-600">Loading attempts...</div>
            ) : visibleAttemptList.length === 0 ? (
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm text-slate-600">No submitted exam attempts are ready for educator grading yet.</div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-3 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-sm font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    checked={showPendingOnly}
                    onChange={(event) => setShowPendingOnly(event.target.checked)}
                  />
                  Show only pending educator review
                </label>
                {visibleAttemptList.map((attempt) => (
                  <button
                    key={attempt.attempt_id}
                    type="button"
                    onClick={() => loadAttempt(attempt.attempt_id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      activeAttemptId === attempt.attempt_id
                        ? 'border-[#f2e9c4] bg-[#fafafa]'
                        : 'border-[#d4d4d8] bg-white hover:bg-[#fafafa]'
                    }`}
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18181b]">{attempt.student_name}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Pending question reviews: <span className="font-semibold text-slate-900">{attempt.pending_review_count}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Current score: <span className="font-semibold text-slate-900">{attempt.score}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="space-y-6">
          {!activeAttempt ? (
            <div className="card p-8 text-sm text-slate-600">Choose a submitted attempt to begin the educator grading review.</div>
          ) : (
            <>
              <section className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="section-kicker text-[#18181b]">Educator grading review</p>
                    <h2 className="mt-2 text-3xl font-bold text-slate-950">{activeAttempt.student_name}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Review the descriptive response quality, attached handwritten images, and AI confidence question by question before finalizing the released score.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Current score</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950">{activeAttempt.score}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <Metric label="Objective" value={String(activeAttempt.objective_score)} />
                  <Metric label="Descriptive" value={String(activeAttempt.descriptive_score)} />
                  <Metric label="Pending" value={String(activeAttempt.pending_review_count)} />
                  <Metric label="Status" value={activeAttempt.teacher_review_required ? 'Needs review' : 'Reviewed'} />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Metric label="Release reviewed score" value={`${releaseScore}`} />
                  <Metric label="Questions in desk" value={String(activeAttempt.question_reviews.length)} />
                  <Metric label="Next student requiring review" value={nextReviewAttempt?.student_name || 'Queue complete'} />
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-3xl border border-[#d4d4d8] bg-white p-5">
                    <p className="section-kicker text-[#18181b]">Question navigator</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {questionNavigator.map((item) => (
                        <div key={item.response_id || item.question_id} className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{item.label}</span>
                            <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{item.review_status}</span>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-950">{item.prompt_preview || 'Prompt preview will appear here.'}</p>
                          <p className="mt-2 text-sm text-slate-600">
                            {item.teacher_review_required ? 'Still requires educator review.' : 'Ready for score release.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] p-5">
                    <p className="section-kicker text-[#18181b]">Educator release checklist</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Keep this visible while you grade so the final release step stays deliberate and educator-led.
                    </p>
                    <div className="mt-4 space-y-3">
                      {releaseSummary.checklist.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-[#d4d4d8] bg-white p-4">
                          <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                          <p className={`mt-2 text-sm font-semibold ${item.complete ? 'text-zinc-700' : 'text-zinc-700'}`}>
                            {item.complete ? 'Complete' : 'Still needs attention'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {(activeAttempt.low_confidence_reasons || []).length > 0 && (
                  <div className="mt-5 rounded-3xl border border-zinc-300 bg-zinc-100 p-4 text-sm text-zinc-900">
                    <p className="font-semibold">AI low-confidence reasons</p>
                    <p className="mt-2">{activeAttempt.low_confidence_reasons.join(', ')}</p>
                  </div>
                )}
              </section>

              <section className="space-y-5">
                {activeAttempt.question_reviews.map((question, index) => {
                  const draft = reviewDraft.responses[question.response_id] || {}
                  const scoreValue = draft.teacher_score ?? question.teacher_score ?? question.ai_score ?? 0
                  const feedbackValue = draft.teacher_feedback ?? question.teacher_feedback ?? ''
                  return (
                    <article key={question.response_id || question.question_id} className="card p-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">Question {index + 1}</span>
                        <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{question.question_type}</span>
                        <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{question.response_mode}</span>
                      </div>
                      <h3 className="mt-4 text-2xl font-bold text-slate-950">{question.prompt}</h3>

                      {(question.grading_keywords || []).length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {question.grading_keywords.map((keyword) => (
                            <span key={keyword} className="role-pill border-[#d4d4d8] bg-[#fafafa] text-[#3f3f46]">{keyword}</span>
                          ))}
                        </div>
                      )}

                      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-4">
                          <div className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Student answer</p>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{question.typed_answer || 'No typed answer submitted.'}</p>
                          </div>

                          {(question.uploaded_image_urls || []).length > 0 && (
                            <div className="rounded-3xl border border-[#d4d4d8] bg-white p-4">
                              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">
                                <FileImage className="h-4 w-4" />
                                Uploaded answer evidence
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {question.uploaded_image_urls.map((imageUrl, imageIndex) => (
                                  <img key={`${question.question_id}-image-${imageIndex}`} src={imageUrl} alt={`Student response ${imageIndex + 1}`} className="w-full rounded-2xl border border-[#d4d4d8] object-cover" />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">AI guidance</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              <p>AI score suggestion: <span className="font-semibold text-slate-950">{question.ai_score}</span> / {question.marks}</p>
                              <p>Confidence: <span className="font-semibold text-slate-950">{question.ai_confidence ?? 'n/a'}</span></p>
                              <p>Model answer: <span className="font-semibold text-slate-950">{question.answer_key || 'Not provided'}</span></p>
                            </div>
                            {question.rubric_summary?.auto_feedback ? (
                              <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                                {question.rubric_summary.auto_feedback}
                              </div>
                            ) : null}
                            {question.rubric_summary ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <Metric label="Coverage" value={String(question.rubric_summary.coverage_score ?? '0')} />
                                <Metric label="Reasoning" value={String(question.rubric_summary.reasoning_signal ?? '0')} />
                                <Metric label="Model alignment" value={String(question.rubric_summary.answer_key_alignment ?? '0')} />
                                <Metric label="Length fit" value={String(question.rubric_summary.length_signal ?? '0')} />
                              </div>
                            ) : null}
                            {(question.rubric_summary?.matched_keywords || []).length > 0 ? (
                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Matched keywords</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {question.rubric_summary.matched_keywords.map((keyword) => (
                                    <span key={`${question.question_id}-${keyword}`} className="role-pill border-zinc-300 bg-zinc-100 text-zinc-800">{keyword}</span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {(question.rubric_summary?.missed_keywords || []).length > 0 ? (
                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Missing targets</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {question.rubric_summary.missed_keywords.map((keyword) => (
                                    <span key={`${question.question_id}-missed-${keyword}`} className="role-pill border-zinc-300 bg-zinc-100 text-zinc-800">{keyword}</span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {(question.ai_review_reasons || []).length > 0 ? (
                              <div className="mt-4 rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-900">
                                Review triggers: {question.ai_review_reasons.join(', ')}
                              </div>
                            ) : null}
                          </div>

                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-900">Educator score</span>
                            <input
                              type="number"
                              min="0"
                              max={question.marks}
                              step="0.5"
                              value={scoreValue}
                              onChange={(event) => updateResponseDraft(question.response_id, { teacher_score: event.target.value })}
                              className="input"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-900">Educator feedback</span>
                            <textarea
                              value={feedbackValue}
                              onChange={(event) => updateResponseDraft(question.response_id, { teacher_feedback: event.target.value })}
                              className="input min-h-[160px]"
                              placeholder="Write the feedback or rubric note that should accompany the released score."
                            />
                          </label>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>

              <section className="card p-6">
                <p className="section-kicker text-[#18181b]">Release summary</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">Educator summary</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Finalize Educator Review only when the released score, per-question overrides, and the classroom-facing feedback are ready to send back to the learner.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Metric label="Release reviewed score" value={`${releaseSummary.release_score}`} />
                  <Metric label="Pending question checks" value={String(releaseSummary.pending_review_count)} />
                  <Metric label="Next student requiring review" value={nextReviewAttempt?.student_name || 'None waiting'} />
                </div>
                <textarea
                  value={reviewDraft.overall_feedback}
                  onChange={(event) => setReviewDraft((current) => ({ ...current, overall_feedback: event.target.value }))}
                  className="input mt-4 min-h-[160px]"
                  placeholder="Summarize the overall performance, misconceptions, and next-step advice for the student."
                />
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={handleSaveReview} disabled={saving} className="btn btn-primary inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? 'Saving review...' : 'Finalize Educator Review'}
                  </button>
                  {nextReviewAttempt && (
                    <button
                      type="button"
                      onClick={() => loadAttempt(nextReviewAttempt.attempt_id)}
                      className="btn btn-outline"
                    >
                      Next student requiring review
                    </button>
                  )}
                  <Link href="/educator/anticheat-bot" className="btn btn-outline inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Review Anti-Cheat Cases
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </AppShell>
  )
}

function buildDraft(attempt) {
  return {
    overall_feedback: attempt?.overall_feedback || '',
    responses: (attempt?.question_reviews || []).reduce((accumulator, question) => {
      if (!question.response_id) return accumulator
      accumulator[question.response_id] = {
        teacher_score: question.teacher_score ?? question.ai_score ?? 0,
        teacher_feedback: question.teacher_feedback || ''
      }
      return accumulator
    }, {})
  }
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    </div>
  )
}
