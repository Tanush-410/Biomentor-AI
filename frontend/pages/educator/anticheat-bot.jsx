import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Camera, ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import AISpotlightBanner from '../../components/AISpotlightBanner'
import { useAuth } from '../../context/AuthContext'
import { backendOrigin } from '../../lib/backendApi'
import {
  excuseAnticheatBotCase,
  getAnticheatBotCaseDetail,
  getAnticheatBotCases,
  listClassrooms,
  reopenAnticheatBotCase,
  upholdAnticheatBotCase
} from '../../lib/classroomApi'

export default function EducatorAnticheatBotPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classrooms, setClassrooms] = useState([])
  const [classroomId, setClassroomId] = useState('')
  const [cases, setCases] = useState([])
  const [activeCaseId, setActiveCaseId] = useState('')
  const [activeCase, setActiveCase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [caseLoading, setCaseLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [imageCache, setImageCache] = useState({})

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
    loadClassrooms()
  }, [authLoading, token, user?.role])

  useEffect(() => {
    if (!classroomId) return
    loadCases(classroomId)
  }, [classroomId])

  useEffect(() => {
    if (!classroomId || !activeCaseId) {
      setActiveCase(null)
      return
    }
    loadCaseDetail(classroomId, activeCaseId)
  }, [classroomId, activeCaseId])

  const loadClassrooms = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await listClassrooms(token)
      const classroomList = payload.classrooms || payload || []
      setClassrooms(classroomList)
      const nextId = classroomList?.[0]?.id || ''
      setClassroomId(nextId)
      if (nextId) {
        await loadCases(nextId)
      }
    } catch (err) {
      setError(err.message || 'Could not load anti-cheat bot classrooms.')
      setLoading(false)
    }
  }

  const loadCases = async (targetClassroomId) => {
    setLoading(true)
    setError('')
    try {
      const payload = await getAnticheatBotCases(token, targetClassroomId)
      const nextCases = payload.cases || []
      setCases(nextCases)
      setActiveCaseId((current) => {
        if (current && nextCases.some((item) => item.id === current)) return current
        return nextCases[0]?.id || ''
      })
      return nextCases
    } catch (err) {
      setError(err.message || 'Could not load anti-cheat cases.')
      setCases([])
      setActiveCaseId('')
      setActiveCase(null)
      return []
    } finally {
      setLoading(false)
    }
  }

  const loadCaseDetail = async (targetClassroomId, caseId) => {
    setCaseLoading(true)
    try {
      const payload = await getAnticheatBotCaseDetail(token, targetClassroomId, caseId)
      setActiveCase(payload.case || null)
    } catch (err) {
      setActiveCase(null)
      setError(err.message || 'Could not load the selected anti-cheat case.')
    } finally {
      setCaseLoading(false)
    }
  }

  const handleCaseAction = async (action, caseId) => {
    if (!classroomId || !caseId) return
    setActionLoading(`${action}:${caseId}`)
    setError('')
    setActionMessage('')

    try {
      const actionMap = {
        uphold: upholdAnticheatBotCase,
        excuse: excuseAnticheatBotCase,
        reopen: reopenAnticheatBotCase
      }
      const response = await actionMap[action](token, classroomId, caseId)
      setActionMessage(response.message || 'Case updated.')
      const nextCases = await loadCases(classroomId)
      if (action === 'excuse') {
        if (!nextCases.length) {
          setActiveCase(null)
          return
        }
        const nextId = nextCases[0]?.id || ''
        setActiveCaseId(nextId)
        if (nextId) {
          await loadCaseDetail(classroomId, nextId)
        }
        return
      }
      setActiveCaseId(caseId)
      await loadCaseDetail(classroomId, caseId)
    } catch (err) {
      setError(err.message || 'Could not update the anti-cheat case.')
    } finally {
      setActionLoading('')
    }
  }

  const selectedClassroom = classrooms.find((item) => item.id === classroomId)

  return (
    <AppShell
      title="Anticheat Bot"
      eyebrow="Educator review desk"
      description="Review final debarred or educator-review-required cases with the last three evidence snapshots captured during protected quizzes and exams."
      actions={
        <>
          <Link href="/educator/exam-maker" className="btn btn-outline">Open Exam Maker</Link>
          <Link href="/educator/quiz-maker" className="btn btn-outline">Open Quiz Maker</Link>
        </>
      }
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}
      {actionMessage && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-700">{actionMessage}</div>}

      <AISpotlightBanner
        eyebrow="Integrity AI Surface"
        title="Final review cases, not noisy raw logs."
        description="The anti-cheat bot focuses the educator on the cases that matter: attempts ended automatically, why that happened, and the latest evidence snapshots attached to each review card."
        highlights={['Final debarred cases', 'Last three evidence snapshots', 'Educator review required posture']}
        primaryAction={{ label: 'Jump to Cases', href: '#anticheat-cases' }}
        secondaryAction={{ label: 'Build New Exam', href: '/educator/exam-maker' }}
        status="Warnings alone do not decide guilt here. The product stores the final case and the evidence trail so the educator stays in control of the decision."
      />

      <section className="card p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="section-kicker text-[#18181b]">Review scope</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Anti-cheat educator review queue</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Choose a classroom to inspect the final review cases. Each case shows the assessment type, the reason the attempt ended, and the newest evidence still worth checking.
            </p>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-900">Classroom</span>
            <select value={classroomId} onChange={(event) => setClassroomId(event.target.value)} className="input">
              <option value="">Select classroom</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section id="anticheat-cases" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {loading ? (
            <div className="card p-8 text-sm text-slate-600">Loading anti-cheat cases...</div>
          ) : cases.length === 0 ? (
            <div className="card p-8 text-sm text-slate-600">No final anti-cheat cases are stored for {selectedClassroom?.name || 'this classroom'} yet.</div>
          ) : (
            cases.map((item) => (
              <article key={item.id} className="card p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{item.assessment_type}</span>
                  <span className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">{item.status}</span>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-slate-950">{item.student_name || item.student_id}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Final case reason: <span className="font-semibold text-slate-900">{item.final_case_reason || 'educator review required'}</span>
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <InfoTile label="Warnings" value={String(item.latest_warning_count || 0)} />
                  <InfoTile label="Assessment" value={item.assessment_type} />
                  <InfoTile label="Review" value={item.teacher_review_required ? 'Required' : 'Resolved'} />
                </div>
                {item.signal_summary ? (
                  <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">AI case reading</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <InfoTile label="Hard-rule signals" value={String(item.signal_summary.hard_rule_count || 0)} />
                      <InfoTile label="Heuristic signals" value={String(item.signal_summary.heuristic_count || 0)} />
                      <InfoTile label="Snapshots" value={String(item.signal_summary.camera_evidence_count || 0)} />
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.signal_summary.teacher_note}</p>
                  </div>
                ) : null}
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {(item.evidence_snapshots || []).map((snapshot) => (
                    <div key={snapshot.id} className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">
                        <Camera className="h-3.5 w-3.5" />
                        Evidence
                      </div>
                      {snapshot.image_url ? (
                        <ProtectedEvidenceImage
                          token={token}
                          cache={imageCache}
                          setCache={setImageCache}
                          snapshot={snapshot}
                        />
                      ) : (
                        <div className="mt-3 flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#d4d4d8] bg-white text-sm text-slate-500">
                          Snapshot stored without image
                        </div>
                      )}
                      <p className="mt-3 text-sm font-semibold text-slate-900">{snapshot.violation_type}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#18181b]">
                        {snapshot.signal_family?.replace('_', ' ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{snapshot.captured_at}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setActiveCaseId(item.id)} className="btn btn-outline">
                    Inspect Case
                  </button>
                  {item.assessment_type === 'exam' && item.assessment_id && (
                    <Link
                      href={`/educator/exam-review/${item.assessment_id}?classroomId=${classroomId}${item.attempt_id ? `&attemptId=${item.attempt_id}` : ''}`}
                      className="btn btn-outline"
                    >
                      Open grading desk
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCaseAction('uphold', item.id)}
                    disabled={Boolean(actionLoading)}
                    className="btn btn-primary"
                  >
                    {actionLoading === `uphold:${item.id}` ? 'Upholding...' : 'Uphold'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCaseAction('excuse', item.id)}
                    disabled={Boolean(actionLoading)}
                    className="btn btn-outline"
                  >
                    {actionLoading === `excuse:${item.id}` ? 'Excusing...' : 'Excuse'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCaseAction('reopen', item.id)}
                    disabled={Boolean(actionLoading)}
                    className="btn btn-outline"
                  >
                    {actionLoading === `reopen:${item.id}` ? 'Reopening...' : 'Reopen'}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="space-y-5">
          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Selected case</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Educator action desk</h3>
            {caseLoading ? (
              <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm text-slate-600">Loading selected case...</div>
            ) : !activeCase ? (
              <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm text-slate-600">Choose a case from the review queue to inspect its evidence and final reason in one place.</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Student</p>
                  <p className="mt-2 text-lg font-bold text-slate-950">{activeCase.student_name || activeCase.student_id}</p>
                </div>
                <div className="rounded-2xl border border-[#d4d4d8] bg-white p-4">
                  <p className="section-kicker text-[#18181b]">Case decision summary</p>
                  <div className="mt-3 grid gap-3">
                    <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                      <p className="text-sm font-semibold text-slate-950">Educator review required</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {activeCase.teacher_review_required ? 'Yes, this case still needs an educator decision.' : 'No, this case has already been resolved.'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                      <p className="text-sm font-semibold text-slate-950">Assessment path</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {activeCase.assessment_type === 'exam'
                          ? 'This case came from a protected classroom exam attempt and can be routed into the review desk.'
                          : 'This case came from a protected classroom quiz attempt.'}
                      </p>
                    </div>
                    {activeCase.signal_summary ? (
                      <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                        <p className="text-sm font-semibold text-slate-950">Signal mix</p>
                        <p className="mt-2 text-sm text-slate-600">{activeCase.signal_summary.teacher_note}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#18181b]">
                          <span className="rounded-full border border-[#d4d4d8] bg-white px-3 py-1">
                            Hard-rule {activeCase.signal_summary.hard_rule_count || 0}
                          </span>
                          <span className="rounded-full border border-[#d4d4d8] bg-white px-3 py-1">
                            Heuristic {activeCase.signal_summary.heuristic_count || 0}
                          </span>
                          <span className="rounded-full border border-[#d4d4d8] bg-white px-3 py-1">
                            Snapshots {activeCase.signal_summary.camera_evidence_count || 0}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Final reason</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{activeCase.final_case_reason || 'educator review required'}</p>
                  {activeCase.final_recommendation ? (
                    <p className="mt-3 text-sm font-semibold text-slate-900">{activeCase.final_recommendation}</p>
                  ) : null}
                  {activeCase.last_three_reasons?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeCase.last_three_reasons.map((reason) => (
                        <span key={reason} className="rounded-full border border-[#d4d4d8] bg-white px-3 py-1 text-xs font-semibold text-[#18181b]">
                          {reason.replaceAll('_', ' ')}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Warning count</p>
                  <p className="mt-2 text-lg font-bold text-slate-950">{activeCase.latest_warning_count || 0}</p>
                </div>
                {activeCase.assessment_type === 'exam' && activeCase.assessment_id && (
                  <Link
                    href={`/educator/exam-review/${activeCase.assessment_id}?classroomId=${classroomId}${activeCase.attempt_id ? `&attemptId=${activeCase.attempt_id}` : ''}`}
                    className="btn btn-outline"
                  >
                    Review grading desk
                  </Link>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleCaseAction('uphold', activeCase.id)}
                    disabled={Boolean(actionLoading)}
                    className="btn btn-primary"
                  >
                    {actionLoading === `uphold:${activeCase.id}` ? 'Upholding...' : 'Uphold'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCaseAction('excuse', activeCase.id)}
                    disabled={Boolean(actionLoading)}
                    className="btn btn-outline"
                  >
                    {actionLoading === `excuse:${activeCase.id}` ? 'Excusing...' : 'Excuse'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCaseAction('reopen', activeCase.id)}
                    disabled={Boolean(actionLoading)}
                    className="btn btn-outline"
                  >
                    {actionLoading === `reopen:${activeCase.id}` ? 'Reopening...' : 'Reopen'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Review intent</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Why this desk exists</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">Only the final case is elevated here, so educators are not buried under every minor event.</div>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">The product keeps the last three snapshots because that is usually enough to validate the final call quickly.</div>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">Both quizzes and exams can feed this desk as protected assessments expand.</div>
            </div>
          </div>

          <div className="card p-6">
            <div className="inline-flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-[#18181b]" />
              <h3 className="text-xl font-bold text-slate-950">Case handling rule</h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Auto-ended attempts should stay in educator review required until the educator confirms the final outcome. This keeps the anti-cheat system assertive without turning it into a silent judge.
            </p>
          </div>
        </aside>
      </section>
    </AppShell>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  )
}

function ProtectedEvidenceImage({ token, cache, setCache, snapshot }) {
  const [status, setStatus] = useState(snapshot.image_url ? 'loading' : 'empty')

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    const loadImage = async () => {
      if (!snapshot?.image_url || !token) {
        setStatus('empty')
        return
      }
      if (cache[snapshot.id]) {
        setStatus('ready')
        return
      }

      try {
        const base = backendOrigin()
        const targetUrl = snapshot.image_url.startsWith('http') ? snapshot.image_url : `${base}${snapshot.image_url}`
        const response = await fetch(targetUrl, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        if (!response.ok) {
          throw new Error('Could not load evidence image')
        }
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) {
          setCache((current) => ({ ...current, [snapshot.id]: objectUrl }))
          setStatus('ready')
        }
      } catch (_error) {
        if (!cancelled) {
          setStatus('failed')
        }
      }
    }

    loadImage()
    return () => {
      cancelled = true
    }
  }, [cache, setCache, snapshot, token])

  if (cache[snapshot.id]) {
    return <img src={cache[snapshot.id]} alt={snapshot.violation_type} className="mt-3 h-40 w-full rounded-2xl object-cover" />
  }

  if (status === 'failed') {
    return (
      <div className="mt-3 flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#d4d4d8] bg-white text-sm text-slate-500">
        Could not load the evidence image yet
      </div>
    )
  }

  return (
    <div className="mt-3 flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#d4d4d8] bg-white text-sm text-slate-500">
      Loading evidence image...
    </div>
  )
}
