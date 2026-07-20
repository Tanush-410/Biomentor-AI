import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Award,
  ClipboardCheck,
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react'

import ClassroomShell from '../../../../components/ClassroomShell'
import { useAuth } from '../../../../context/AuthContext'
import {
  completeClassroomCertificationStep,
  getClassroom,
  getClassroomCertificationRoster,
  getMyClassroomCertification,
  issueClassroomCertificate,
  overrideClassroomCertificationStep,
  submitClassroomCertificationProof
} from '../../../../lib/classroomApi'

function statusTone(status = '') {
  const normalized = String(status || '').toLowerCase()
  if (['completed', 'issued'].includes(normalized)) return 'border-zinc-300 bg-zinc-100 text-zinc-700'
  if (['ready_for_review', 'pending_review'].includes(normalized)) return 'border-zinc-300 bg-zinc-100 text-zinc-700'
  if (['in_progress', 'available'].includes(normalized)) return 'border-zinc-300 bg-zinc-100 text-zinc-900'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

function prettifyStatus(status = '') {
  return String(status || 'unknown').replaceAll('_', ' ')
}

function formatDate(value) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function buildInitialProofState(steps = []) {
  return steps.reduce((accumulator, step) => {
    accumulator[step.id] = { proof_url: '', text_note: '' }
    return accumulator
  }, {})
}

export default function ClassroomCertificationDetailPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [certification, setCertification] = useState(null)
  const [roster, setRoster] = useState([])
  const [viewerProgress, setViewerProgress] = useState(null)
  const [proofDrafts, setProofDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const classroomId = typeof router.query.id === 'string' ? router.query.id : ''
  const certificationId = typeof router.query.certificationId === 'string' ? router.query.certificationId : ''
  const isEducator = ['educator', 'admin'].includes(user?.role)
  const isStudent = user?.role === 'student'

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!classroomId || !certificationId) return
    void loadPage()
  }, [authLoading, token, router.isReady, classroomId, certificationId, user?.role])

  const activeProgressSteps = useMemo(
    () => viewerProgress?.steps || [],
    [viewerProgress]
  )

  async function loadPage() {
    setLoading(true)
    setError('')
    try {
      const classroomPayload = await getClassroom(token, classroomId)
      setClassroom(classroomPayload.classroom)

      if (isEducator) {
        const payload = await getClassroomCertificationRoster(token, classroomId, certificationId)
        setCertification(payload.certification)
        setRoster(payload.roster || [])
        setViewerProgress(null)
        setProofDrafts({})
      } else {
        const payload = await getMyClassroomCertification(token, classroomId, certificationId)
        setCertification(payload.certification)
        setViewerProgress(payload.certification?.viewer_progress || null)
        setRoster([])
        setProofDrafts(buildInitialProofState(payload.certification?.viewer_progress?.steps || []))
      }
    } catch (err) {
      setError(err.message || 'Could not load certification workspace.')
    } finally {
      setLoading(false)
    }
  }

  function updateProofDraft(stepId, patch) {
    setProofDrafts((current) => ({
      ...current,
      [stepId]: {
        ...(current[stepId] || { proof_url: '', text_note: '' }),
        ...patch
      }
    }))
  }

  async function handleCompleteStep(step) {
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await completeClassroomCertificationStep(token, classroomId, certificationId, step.id, {
        note: step.step_type === 'custom_checkpoint' ? 'Completed from classroom certification workspace.' : null,
        proof_url: null
      })
      setSuccess('Certification step updated.')
      await loadPage()
    } catch (err) {
      setError(err.message || 'Could not update certification step.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSubmitProof(step) {
    const draft = proofDrafts[step.id] || { proof_url: '', text_note: '' }
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await submitClassroomCertificationProof(token, classroomId, certificationId, {
        step_id: step.id,
        proof_type: 'link',
        proof_url: draft.proof_url || null,
        text_note: draft.text_note || null
      })
      setSuccess('Proof submitted for educator review.')
      await loadPage()
    } catch (err) {
      setError(err.message || 'Could not submit proof.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApproveStep(studentId, stepId, nextStatus = 'completed') {
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await overrideClassroomCertificationStep(token, classroomId, certificationId, {
        student_id: studentId,
        step_id: stepId,
        status: nextStatus,
        note: nextStatus === 'completed' ? 'Approved from certification roster.' : 'Returned for additional work.'
      })
      setSuccess(nextStatus === 'completed' ? 'Milestone approved.' : 'Milestone sent back for more work.')
      await loadPage()
    } catch (err) {
      setError(err.message || 'Could not update certification review state.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleIssueCertificate(studentId) {
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const payload = await issueClassroomCertificate(token, classroomId, certificationId, studentId)
      const certificateIdToOpen = payload?.certificate?.id
      setSuccess('Certificate issued successfully.')
      await loadPage()
      if (certificateIdToOpen) {
        router.push(`/certificate/${certificateIdToOpen}`)
      }
    } catch (err) {
      setError(err.message || 'Could not issue the certificate.')
    } finally {
      setActionLoading(false)
    }
  }

  const actions = certification ? (
    <>
      {isEducator ? (
        <Link href="/educator/certification" className="btn btn-outline">
          Open Certification Studio
        </Link>
      ) : null}
      <Link href={`/classrooms/${classroomId}/classwork`} className="btn btn-outline">
        Back to Classwork
      </Link>
    </>
  ) : null

  return (
    <ClassroomShell classroom={classroom} activeTab="classwork" isLoading={loading} error={error} actions={actions}>
      {success ? (
        <div className="rounded-[18px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-700">
          {success}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-[#18181b]">Certification Path</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-950">{certification?.title || 'Certification workspace'}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {certification?.description || 'Track milestone completion, review external proof, and issue VYDRA CORE certificates from one classroom surface.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`role-pill ${statusTone(certification?.status)}`}>{prettifyStatus(certification?.status)}</span>
                <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">
                  {certification?.course_mode === 'external_course' ? 'External + VYDRA CORE' : 'VYDRA CORE track'}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Issuer</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{certification?.issuer_name || 'VYDRA CORE'}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Milestones</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{certification?.steps?.length || 0}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Approval mode</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{certification?.requires_teacher_approval ? 'Educator review' : 'Auto progression'}</p>
              </div>
            </div>
          </div>

          {isStudent ? (
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="section-kicker text-[#18181b]">Learner Progress</p>
                  <h3 className="text-2xl font-bold text-slate-950">Complete each milestone to unlock your certificate.</h3>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="surface-subtle p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Status</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{prettifyStatus(viewerProgress?.status)}</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Completion</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{Math.round(viewerProgress?.completion_percentage || 0)}%</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Proof state</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{prettifyStatus(viewerProgress?.proof_status || 'not_required')}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {activeProgressSteps.map((step, index) => {
                  const draft = proofDrafts[step.id] || { proof_url: '', text_note: '' }
                  const isExternalReview = step.step_type === 'external_link' && certification?.requires_teacher_approval
                  const canMarkComplete = !['quiz', 'exam', 'external_link'].includes(step.step_type) && step.status !== 'completed'
                  const canSubmitProof = isExternalReview && step.status !== 'completed'

                  return (
                    <div key={step.id} className="rounded-[24px] border border-[#d4d4d8] bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Milestone {index + 1}</p>
                          <h4 className="mt-2 text-xl font-bold text-slate-950">{step.title}</h4>
                          {step.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p> : null}
                        </div>
                        <span className={`role-pill ${statusTone(step.status)}`}>{prettifyStatus(step.status)}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                        <span>Type: {prettifyStatus(step.step_type)}</span>
                        {step.minimum_score != null ? <span>Minimum score: {Math.round(step.minimum_score)}%</span> : null}
                        {step.completed_at ? <span>Completed: {formatDate(step.completed_at)}</span> : null}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        {step.launch_url ? (
                          <Link
                            href={step.launch_url}
                            target={step.launch_url.startsWith('http') ? '_blank' : undefined}
                            rel={step.launch_url.startsWith('http') ? 'noreferrer' : undefined}
                            className="btn btn-outline"
                          >
                            Open milestone
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {canMarkComplete ? (
                          <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={() => handleCompleteStep(step)}>
                            Mark complete
                          </button>
                        ) : null}
                      </div>

                      {canSubmitProof ? (
                        <div className="mt-5 grid gap-4 rounded-[22px] border border-[#d4d4d8] bg-[#fafafa] p-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Submit external completion proof</p>
                            <p className="mt-1 text-sm text-slate-600">Paste a proof link and a short educator note so your educator can review it.</p>
                          </div>
                          <input
                            className="input"
                            value={draft.proof_url}
                            onChange={(event) => updateProofDraft(step.id, { proof_url: event.target.value })}
                            placeholder="Proof URL"
                          />
                          <textarea
                            className="input min-h-[100px]"
                            value={draft.text_note}
                            onChange={(event) => updateProofDraft(step.id, { text_note: event.target.value })}
                            placeholder="What did you complete and what should your educator check?"
                          />
                          <div>
                            <button type="button" className="btn btn-primary" disabled={actionLoading || (!draft.proof_url && !draft.text_note)} onClick={() => handleSubmitProof(step)}>
                              Send proof for review
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {viewerProgress?.issued_certificate_id ? (
                <div className="mt-6 rounded-[22px] border border-zinc-300 bg-zinc-100 p-5">
                  <div className="flex items-center gap-3">
                    <Award className="h-5 w-5 text-zinc-700" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Certificate ready</p>
                      <p className="text-sm text-zinc-700">Your educator has already issued this certificate.</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link href={`/certificate/${viewerProgress.issued_certificate_id}`} className="btn btn-outline">
                      View certificate
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {isEducator ? (
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="section-kicker text-[#18181b]">Educator Review</p>
                  <h3 className="text-2xl font-bold text-slate-950">Roster, evidence, and certificate issuing.</h3>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {roster.length === 0 ? (
                  <div className="surface-subtle p-4 text-sm text-slate-600">No learners are enrolled in this classroom certification yet.</div>
                ) : roster.map((entry) => (
                  <div key={entry.student_id} className="rounded-[24px] border border-[#d4d4d8] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-bold text-slate-950">{entry.student_name}</h4>
                        <p className="mt-2 text-sm text-slate-600">{Math.round(entry.completion_percentage || 0)}% complete · Proof {prettifyStatus(entry.proof_status)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`role-pill ${statusTone(entry.status)}`}>{prettifyStatus(entry.status)}</span>
                        {entry.issued_certificate_id ? (
                          <Link href={`/certificate/${entry.issued_certificate_id}`} className="btn btn-outline">
                            View certificate
                          </Link>
                        ) : entry.ready_for_issue ? (
                          <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={() => handleIssueCertificate(entry.student_id)}>
                            Issue certificate
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-3">
                        {(entry.steps || []).map((step) => (
                          <div key={step.id} className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">{step.title}</p>
                                <p className="mt-1 text-sm text-slate-600">{prettifyStatus(step.step_type)} · {step.minimum_score != null ? `${Math.round(step.minimum_score)}% minimum` : 'No score gate'}</p>
                              </div>
                              <span className={`role-pill ${statusTone(step.status)}`}>{prettifyStatus(step.status)}</span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                              {step.launch_url ? (
                                <Link href={step.launch_url} className="btn btn-outline">
                                  Open resource
                                </Link>
                              ) : null}
                              {step.status !== 'completed' ? (
                                <button type="button" className="btn btn-outline" disabled={actionLoading} onClick={() => handleApproveStep(entry.student_id, step.id, 'completed')}>
                                  Approve milestone
                                </button>
                              ) : null}
                              {step.status === 'pending_review' ? (
                                <button type="button" className="btn btn-outline" disabled={actionLoading} onClick={() => handleApproveStep(entry.student_id, step.id, 'available')}>
                                  Return for revision
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[24px] border border-[#d4d4d8] bg-[#fafafa] p-4">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-[#18181b]" />
                          <p className="text-sm font-semibold text-slate-950">Educator review queue</p>
                        </div>
                        {entry.proof_submissions?.length ? (
                          <div className="mt-4 space-y-3">
                            {entry.proof_submissions.map((proof) => (
                              <div key={proof.id} className="rounded-2xl border border-[#d4d4d8] bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">{prettifyStatus(proof.proof_type)}</p>
                                {proof.proof_url ? (
                                  <Link href={proof.proof_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#3f3f46]">
                                    Open proof link
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                ) : null}
                                {proof.text_note ? <p className="mt-3 text-sm leading-6 text-slate-600">{proof.text_note}</p> : null}
                                <p className="mt-3 text-xs text-slate-500">Submitted {formatDate(proof.submitted_at)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 text-sm text-slate-600">No external proof submissions yet for this learner.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-[#18181b]" />
              <div>
                <p className="section-kicker text-[#18181b]">Certificate Outcome</p>
                <h3 className="text-2xl font-bold text-slate-950">{certification?.certificate_subtitle || 'Certificate of Completion'}</h3>
              </div>
            </div>
            <div className="mt-5 rounded-[28px] border border-[#d4d4d8] bg-[linear-gradient(145deg,#ffffff,#f4f4f5)] p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#18181b]">VYDRA CORE</p>
              <p className="mt-5 text-3xl font-bold text-slate-950">{certification?.title || 'Untitled certification'}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{certification?.completion_message || 'Learners who complete every required checkpoint will unlock a branded VYDRA CORE certificate.'}</p>
            </div>
          </div>

          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Path design</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">What this certification expects</h3>
            <div className="mt-5 space-y-3">
              {(certification?.steps || []).map((step, index) => (
                <div key={step.id} className="surface-quiet p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e4e4e7] text-sm font-semibold text-[#3f3f46]">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">{step.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{prettifyStatus(step.step_type)}{step.required ? ' · Required' : ' · Optional'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Next move</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{isEducator ? 'Issue when the learner is review-ready.' : 'Work milestone by milestone.'}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {isEducator
                ? 'Use this workspace to review evidence, approve exceptions, and issue the final certificate once the path is satisfied.'
                : 'Open linked materials, complete linked quizzes and exams, and submit external proof when the path asks for it.'}
            </p>
          </div>
        </div>
      </section>
    </ClassroomShell>
  )
}
