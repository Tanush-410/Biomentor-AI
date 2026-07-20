import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Award, BookOpen, ExternalLink, FileCheck2, Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import AISpotlightBanner from '../../components/AISpotlightBanner'
import { useAuth } from '../../context/AuthContext'
import { normalizeListPayload } from '../../lib/backendApi'
import {
  createClassroomCertification,
  draftClassroomCertification,
  getClasswork,
  listClassroomExams,
  listClassrooms,
  listDocuments,
  publishClassroomCertification,
} from '../../lib/classroomApi'

function buildStep(index = 0) {
  return {
    local_id: `cert-step-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    step_type: 'custom_checkpoint',
    title: '',
    description: '',
    linked_resource_id: '',
    linked_resource_type: '',
    required: true,
    minimum_score: '',
    metadata: {},
    sort_order: index
  }
}

const STEP_TYPES = [
  { value: 'material', label: 'Material review' },
  { value: 'quiz', label: 'Quiz checkpoint' },
  { value: 'exam', label: 'Exam checkpoint' },
  { value: 'external_link', label: 'External course proof' },
  { value: 'custom_checkpoint', label: 'Manual educator checkpoint' }
]

export default function EducatorCertificationPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classrooms, setClassrooms] = useState([])
  const [documents, setDocuments] = useState([])
  const [materials, setMaterials] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [exams, setExams] = useState([])
  const [existing, setExisting] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    classroom_id: '',
    title: '',
    description: '',
    course_mode: 'biomentor_track',
    provider_name: '',
    external_url: '',
    issuer_name: 'VYDRA CORE',
    certificate_subtitle: 'Certificate of Completion',
    completion_message: 'has completed the required certification path on VYDRA CORE.',
    manual_issue_only: false,
    requires_teacher_approval: true,
    target_outcome: '',
    linked_material_ids: [],
    steps: [buildStep(0)]
  })

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
    void loadBase()
  }, [authLoading, token, user?.role])

  useEffect(() => {
    if (!token || !form.classroom_id) return
    void loadClassroomContext(form.classroom_id)
  }, [token, form.classroom_id])

  const stepOptions = useMemo(() => ({
    material: materials.map((item) => ({ value: item.document_id, label: item.title || item.file_name })),
    quiz: quizzes.map((item) => ({ value: item.id, label: item.title })),
    exam: exams.map((item) => ({ value: item.id, label: item.title }))
  }), [materials, quizzes, exams])

  async function loadBase() {
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, documentPayload] = await Promise.all([
        listClassrooms(token),
        listDocuments(token)
      ])
      const nextClassrooms = normalizeListPayload(classroomPayload, 'classrooms')
      const nextDocuments = normalizeListPayload(documentPayload, 'documents')
      setClassrooms(nextClassrooms)
      setDocuments(nextDocuments)
      setForm((current) => ({
        ...current,
        classroom_id: current.classroom_id || nextClassrooms?.[0]?.id || '',
        linked_material_ids: current.linked_material_ids.length ? current.linked_material_ids : nextDocuments.slice(0, 2).map((item) => item.id)
      }))
    } catch (err) {
      setError(err.message || 'Could not load certification authoring data.')
    } finally {
      setLoading(false)
    }
  }

  async function loadClassroomContext(classroomId) {
    try {
      const [classworkPayload, examPayload] = await Promise.all([
        getClasswork(token, classroomId),
        listClassroomExams(token, classroomId)
      ])
      setMaterials(classworkPayload.materials || [])
      setQuizzes(classworkPayload.quizzes || [])
      setExisting(classworkPayload.certifications || [])
      setExams(examPayload.exams || [])
    } catch (err) {
      setError(err.message || 'Could not load classroom certification context.')
    }
  }

  function updateStep(localId, patch) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, index) => (
        step.local_id === localId ? { ...step, ...patch, sort_order: index } : step
      ))
    }))
  }

  function addStep() {
    setForm((current) => ({
      ...current,
      steps: [...current.steps, buildStep(current.steps.length)]
    }))
  }

  function removeStep(localId) {
    setForm((current) => ({
      ...current,
      steps: current.steps.length === 1 ? current.steps : current.steps.filter((step) => step.local_id !== localId)
    }))
  }

  function moveStep(localId, direction) {
    setForm((current) => {
      const steps = [...current.steps]
      const index = steps.findIndex((step) => step.local_id === localId)
      const targetIndex = index + direction
      if (index === -1 || targetIndex < 0 || targetIndex >= steps.length) return current
      const [moved] = steps.splice(index, 1)
      steps.splice(targetIndex, 0, moved)
      return {
        ...current,
        steps: steps.map((step, order) => ({ ...step, sort_order: order }))
      }
    })
  }

  function normalizeStepPayload(step, index) {
    const stepType = step.step_type
    const linkedResourceType = stepType === 'material'
      ? 'document'
      : stepType === 'quiz'
        ? 'classroom_quiz'
        : stepType === 'exam'
          ? 'classroom_exam'
          : stepType === 'external_link'
            ? 'external_url'
            : null

    const metadata = { ...(step.metadata || {}) }
    if (stepType === 'external_link' && step.linked_resource_id) {
      metadata.external_url = step.linked_resource_id
    }

    return {
      step_type: stepType,
      title: step.title,
      description: step.description || null,
      linked_resource_id: step.linked_resource_id || null,
      linked_resource_type: linkedResourceType,
      required: Boolean(step.required),
      minimum_score: step.minimum_score === '' ? null : Number(step.minimum_score),
      metadata,
      sort_order: index
    }
  }

  async function handleDraft() {
    if (!form.classroom_id) return
    setDrafting(true)
    setError('')
    setSuccess('')
    try {
      const payload = await draftClassroomCertification(token, form.classroom_id, {
        title: form.title || null,
        course_mode: form.course_mode,
        linked_material_ids: form.linked_material_ids,
        target_outcome: form.target_outcome || null
      })
      setForm((current) => ({
        ...current,
        title: payload.draft?.title || current.title,
        description: payload.draft?.description || current.description,
        issuer_name: payload.draft?.issuer_name || current.issuer_name,
        completion_message: payload.draft?.completion_message || current.completion_message,
        steps: (payload.draft?.steps || []).length
          ? payload.draft.steps.map((step, index) => ({
              local_id: buildStep(index).local_id,
              ...step
            }))
          : current.steps
      }))
      setSuccess('AI certification draft prepared. Review the milestones before saving.')
    } catch (err) {
      setError(err.message || 'Could not build a certification draft.')
    } finally {
      setDrafting(false)
    }
  }

  async function handleSave(shouldPublish = false) {
    if (!form.classroom_id) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = await createClassroomCertification(token, form.classroom_id, {
        title: form.title,
        description: form.description || null,
        course_mode: form.course_mode,
        provider_name: form.provider_name || null,
        external_url: form.external_url || null,
        issuer_name: form.issuer_name || null,
        certificate_subtitle: form.certificate_subtitle || null,
        completion_message: form.completion_message || null,
        manual_issue_only: form.manual_issue_only,
        requires_teacher_approval: form.requires_teacher_approval,
        certificate_template: {
          theme: 'biomentor-premium',
          accent: '#c9ab3f',
          seal_label: 'VYDRA CORE'
        },
        ai_notes: {
          target_outcome: form.target_outcome || null,
          linked_material_ids: form.linked_material_ids
        },
        steps: form.steps.map((step, index) => normalizeStepPayload(step, index))
      })
      let savedCertification = payload.certification
      if (shouldPublish && savedCertification?.id) {
        const publishPayload = await publishClassroomCertification(token, form.classroom_id, savedCertification.id)
        savedCertification = publishPayload.certification
      }
      setSuccess(shouldPublish ? 'Certification published to the classroom.' : 'Certification saved as draft.')
      await loadClassroomContext(form.classroom_id)
      if (savedCertification?.id) {
        router.push(`/classrooms/${form.classroom_id}/certification/${savedCertification.id}`)
      }
    } catch (err) {
      setError(err.message || 'Could not save this certification.')
    } finally {
      setSaving(false)
    }
  }

  const actions = (
    <>
      <button type="button" onClick={handleDraft} className="btn btn-outline" disabled={drafting || !form.classroom_id}>
        {drafting ? 'Drafting…' : 'AI Suggest Milestones'}
      </button>
      <button type="button" onClick={() => handleSave(false)} className="btn btn-outline" disabled={saving || !form.title.trim()}>
        Save Draft
      </button>
      <button type="button" onClick={() => handleSave(true)} className="btn btn-primary" disabled={saving || !form.title.trim()}>
        Save & Publish
      </button>
    </>
  )

  return (
    <AppShell
      title="Certification Studio"
      eyebrow="Educator Command"
      description="Build VYDRA CORE-branded certification tracks from classroom material, quizzes, exams, and external course proof so learners can earn real completion certificates."
      contentClassName="space-y-8"
      actions={actions}
    >
      {error ? <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div> : null}
      {success ? <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-700">{success}</div> : null}

      <AISpotlightBanner
        eyebrow="Certification AI Surface"
        title="Turn classroom outcomes into branded completion paths."
        description="Mix VYDRA CORE checkpoints with optional external course proof, let AI suggest milestone order from uploaded material, and issue certificates from the same workflow."
        highlights={['AI certification draft', 'VYDRA CORE-branded certificate', 'Educator issue control']}
        primaryAction={{ label: 'Jump to builder', href: '#certification-builder' }}
        secondaryAction={{ label: 'Open classwork', href: `/classrooms/${form.classroom_id || ''}/classwork` }}
        status="Educators can choose a pure VYDRA CORE path or combine it with external course completion proof."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div id="certification-builder" className="card p-6">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-[#18181b]" />
            <div>
              <p className="section-kicker text-[#18181b]">Builder</p>
              <h2 className="text-2xl font-bold text-slate-950">Certification composer</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">Classroom</span>
              <select className="input" value={form.classroom_id} onChange={(event) => setForm((current) => ({ ...current, classroom_id: event.target.value }))}>
                <option value="">Select classroom</option>
                {classrooms.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">Mode</span>
              <select className="input" value={form.course_mode} onChange={(event) => setForm((current) => ({ ...current, course_mode: event.target.value }))}>
                <option value="biomentor_track">VYDRA CORE completion only</option>
                <option value="external_course">External + VYDRA CORE</option>
              </select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-800">Certification title</span>
              <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Advanced Cell Biology Certificate" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-800">Educator outcome prompt</span>
              <textarea className="input min-h-[110px]" value={form.target_outcome} onChange={(event) => setForm((current) => ({ ...current, target_outcome: event.target.value }))} placeholder="Describe what the learner should be able to do to earn the certificate." />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-800">Description</span>
              <textarea className="input min-h-[110px]" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Explain what this certification validates." />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">Issuer name</span>
              <input className="input" value={form.issuer_name} onChange={(event) => setForm((current) => ({ ...current, issuer_name: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">Certificate subtitle</span>
              <input className="input" value={form.certificate_subtitle} onChange={(event) => setForm((current) => ({ ...current, certificate_subtitle: event.target.value }))} />
            </label>
            {form.course_mode === 'external_course' ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-800">Provider name</span>
                  <input className="input" value={form.provider_name} onChange={(event) => setForm((current) => ({ ...current, provider_name: event.target.value }))} placeholder="Coursera / Educator-set provider" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-800">External course URL</span>
                  <input className="input" value={form.external_url} onChange={(event) => setForm((current) => ({ ...current, external_url: event.target.value }))} placeholder="https://..." />
                </label>
              </>
            ) : null}
          </div>

          <div className="mt-6 rounded-[24px] border border-[#d4d4d8] bg-[#fafafa] p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#18181b]" />
              <div>
                <p className="section-kicker text-[#18181b]">AI draft context</p>
                <h3 className="text-lg font-bold text-slate-950">Choose the material AI should study first</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {documents.map((document) => {
                const selected = form.linked_material_ids.includes(document.id)
                return (
                  <button
                    type="button"
                    key={document.id}
                    onClick={() => setForm((current) => ({
                      ...current,
                      linked_material_ids: selected
                        ? current.linked_material_ids.filter((item) => item !== document.id)
                        : [...current.linked_material_ids, document.id]
                    }))}
                    className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-[#c9ab3f] bg-white shadow-sm' : 'border-[#d4d4d8] bg-[#fafafa]'}`}
                  >
                    <p className="font-semibold text-slate-950">{document.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{document.file_name}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker text-[#18181b]">Milestones</p>
                <h3 className="text-xl font-bold text-slate-950">Structured certification path</h3>
              </div>
              <button type="button" onClick={addStep} className="btn btn-outline">
                <Plus className="h-4 w-4" />
                Add step
              </button>
            </div>
            {form.steps.map((step, index) => {
              const options = stepOptions[step.step_type] || []
              return (
                <div key={step.local_id} className="rounded-[24px] border border-[#d4d4d8] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#18181b]">Step {index + 1}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => moveStep(step.local_id, -1)} className="btn btn-outline">Up</button>
                      <button type="button" onClick={() => moveStep(step.local_id, 1)} className="btn btn-outline">Down</button>
                      <button type="button" onClick={() => removeStep(step.local_id)} className="btn btn-outline">Remove</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-800">Step type</span>
                      <select className="input" value={step.step_type} onChange={(event) => updateStep(step.local_id, { step_type: event.target.value, linked_resource_id: '' })}>
                        {STEP_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-800">Title</span>
                      <input className="input" value={step.title} onChange={(event) => updateStep(step.local_id, { title: event.target.value })} placeholder="Complete the checkpoint" />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-800">Description</span>
                      <textarea className="input min-h-[90px]" value={step.description} onChange={(event) => updateStep(step.local_id, { description: event.target.value })} placeholder="Explain what success looks like." />
                    </label>
                    {step.step_type === 'external_link' ? (
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-800">External milestone URL</span>
                        <input className="input" value={step.linked_resource_id} onChange={(event) => updateStep(step.local_id, { linked_resource_id: event.target.value })} placeholder="https://..." />
                      </label>
                    ) : null}
                    {['material', 'quiz', 'exam'].includes(step.step_type) ? (
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-800">Linked classroom resource</span>
                        <select className="input" value={step.linked_resource_id} onChange={(event) => updateStep(step.local_id, { linked_resource_id: event.target.value })}>
                          <option value="">Select resource</option>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-800">Minimum score</span>
                      <input className="input" type="number" min="0" max="100" value={step.minimum_score} onChange={(event) => updateStep(step.local_id, { minimum_score: event.target.value })} placeholder="Optional" />
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={step.required} onChange={(event) => updateStep(step.local_id, { required: event.target.checked })} />
                      Required milestone
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Certificate preview</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">{form.certificate_subtitle || 'Certificate of Completion'}</h3>
            <div className="mt-5 rounded-[28px] border border-[#d4d4d8] bg-[linear-gradient(145deg,#ffffff,#f4f4f5)] p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#18181b]">VYDRA CORE</p>
              <p className="mt-5 text-3xl font-bold text-slate-950">{form.title || 'Untitled certification'}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{form.completion_message}</p>
              <div className="mt-6 grid gap-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-[#d4d4d8] bg-white px-4 py-3">Issuer: {form.issuer_name || 'VYDRA CORE'}</div>
                <div className="rounded-2xl border border-[#d4d4d8] bg-white px-4 py-3">Mode: {form.course_mode === 'external_course' ? 'External + VYDRA CORE' : 'VYDRA CORE completion only'}</div>
                <div className="rounded-2xl border border-[#d4d4d8] bg-white px-4 py-3">{form.steps.length} milestone(s) configured</div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <FileCheck2 className="h-5 w-5 text-[#18181b]" />
              <div>
                <p className="section-kicker text-[#18181b]">Classroom status</p>
                <h3 className="text-2xl font-bold text-slate-950">Existing certification tracks</h3>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {existing.length === 0 ? (
                <div className="surface-subtle p-4 text-sm text-slate-600">No certification tracks in this classroom yet.</div>
              ) : existing.map((item) => (
                <div key={item.id} className="surface-quiet p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{item.status}</span>
                    <span className="role-pill border-[#d4d4d8] bg-white text-slate-600">{item.steps?.length || 0} steps</span>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  <div className="mt-4">
                    <Link href={`/classrooms/${item.classroom_id}/certification/${item.id}`} className="btn btn-outline">
                      Manage certification
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Linked resource inventory</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">What can feed this certification</h3>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="surface-quiet p-4">
                <div className="flex items-center gap-2 text-slate-950 font-semibold"><BookOpen className="h-4 w-4 text-[#18181b]" /> Materials</div>
                <p className="mt-2">{materials.length} classroom resource(s) available to attach as required checkpoints.</p>
              </div>
              <div className="surface-quiet p-4">
                <div className="flex items-center gap-2 text-slate-950 font-semibold"><Sparkles className="h-4 w-4 text-[#18181b]" /> Quizzes and exams</div>
                <p className="mt-2">{quizzes.length} quiz checkpoint(s) and {exams.length} exam checkpoint(s) available for auto-completion rules.</p>
              </div>
              {form.course_mode === 'external_course' ? (
                <div className="surface-quiet p-4">
                  <div className="flex items-center gap-2 text-slate-950 font-semibold"><ExternalLink className="h-4 w-4 text-[#18181b]" /> External proof mode</div>
                  <p className="mt-2">Learners can submit external completion proof for educator review before certificate issue.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
