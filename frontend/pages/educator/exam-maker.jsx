import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, FileImage, FileText, PenSquare, Plus, Shield, Sparkles, TimerReset, Trash2 } from 'lucide-react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import AISpotlightBanner from '../../components/AISpotlightBanner'
import { useAuth } from '../../context/AuthContext'
import { normalizeListPayload } from '../../lib/backendApi'
import { createClassroomExam, createClassroomExamDraft, listClassrooms, listDocuments } from '../../lib/classroomApi'

const BLOCK_TYPES = [
  { value: 'text', label: 'Instruction text' },
  { value: 'image', label: 'Diagram / image' },
  { value: 'section', label: 'Section divider' },
  { value: 'callout', label: 'Educator callout' },
  { value: 'spacer', label: 'Spacing block' }
]

const QUESTION_TYPES = [
  { value: 'long_text', label: 'Long answer' },
  { value: 'short_text', label: 'Short answer' },
  { value: 'mcq', label: 'Multiple choice' }
]

const RESPONSE_MODES = [
  { value: 'typed', label: 'Typed answer box' },
  { value: 'image_upload', label: 'Image upload answer' },
  { value: 'typed_or_image', label: 'Typed or image answer' }
]

function buildQuestion(index = 0) {
  return {
    local_id: `exam-question-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: '',
    question_type: 'long_text',
    response_mode: 'typed',
    marks: 5,
    answer_key: '',
    grading_keywords: '',
    fixed_response_box: true,
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' }
    ],
    response_config: {
      rows: 6,
      placeholder: 'Students answer in a fixed response box here.'
    }
  }
}

function buildBlock(index = 0) {
  return {
    local_id: `exam-block-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    block_type: 'text',
    title: '',
    content: {
      text: '',
      image_url: '',
      caption: '',
      layout: {
        width: 'full',
        align: 'left',
        tone: 'plain',
        page_break_before: false
      }
    }
  }
}

function getPreviewTextForBlock(block) {
  if (block.block_type === 'image') {
    return block.content?.caption || block.content?.text || 'Diagram block'
  }
  if (block.block_type === 'section') {
    return block.title || block.content?.text || 'Section divider'
  }
  if (block.block_type === 'callout') {
    return block.content?.text || 'Educator callout'
  }
  if (block.block_type === 'spacer') {
    return 'Spacing block'
  }
  return block.content?.text || 'Instruction text'
}

export default function EducatorExamMakerPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classrooms, setClassrooms] = useState([])
  const [documents, setDocuments] = useState([])
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draggedBlockId, setDraggedBlockId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [draftSummary, setDraftSummary] = useState(null)
  const [form, setForm] = useState({
    classroom_id: '',
    title: '',
    description: '',
    instructions: '',
    exam_mode: 'mixed',
    authoring_mode: 'manual',
    generation_scope: 'selected_materials',
    total_marks: 25,
    duration_minutes: 60,
    available_from: '',
    available_until: '',
    publish_to_stream: true,
    proctoring_enabled: true,
    allow_late_entries: false,
    linked_material_ids: [],
    grading_notes: {
      teacher_keywords_intent: 'Use per-question keywords to guide AI grading before educator review.'
    },
    anticheat_policy: {
      end_on_major_violation: true,
      capture_snapshot_on_warning: true,
      final_action: 'teacher_review_required'
    },
    blocks: [buildBlock(1)],
    questions: [buildQuestion(1)]
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
    loadData()
  }, [authLoading, token, user?.role])

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => item.id === form.classroom_id),
    [classrooms, form.classroom_id]
  )

  const linkedDocumentObjects = useMemo(
    () => documents.filter((document) => form.linked_material_ids.includes(document.id)),
    [documents, form.linked_material_ids]
  )

  const totalMarks = useMemo(
    () => form.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0),
    [form.questions]
  )

  const answerBoxPreviewQuestion = useMemo(
    () => form.questions.find((question) => question.response_mode !== 'image_upload') || form.questions[0] || null,
    [form.questions]
  )

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
        linked_material_ids: current.linked_material_ids.length ? current.linked_material_ids : documentList.slice(0, 2).map((item) => item.id)
      }))
    } catch (err) {
      setError(err.message || 'Could not load exam authoring data.')
    }
  }

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const toggleLinkedMaterial = (documentId) => {
    setForm((current) => {
      const exists = current.linked_material_ids.includes(documentId)
      return {
        ...current,
        linked_material_ids: exists
          ? current.linked_material_ids.filter((item) => item !== documentId)
          : [...current.linked_material_ids, documentId]
      }
    })
  }

  const updateQuestion = (localId, patch) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) => (question.local_id === localId ? { ...question, ...patch } : question))
    }))
  }

  const updateQuestionOption = (localId, optionId, value) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.local_id !== localId) return question
        return {
          ...question,
          options: question.options.map((option) => (option.id === optionId ? { ...option, text: value } : option))
        }
      })
    }))
  }

  const addQuestion = () => {
    setForm((current) => ({ ...current, questions: [...current.questions, buildQuestion(current.questions.length + 1)] }))
  }

  const removeQuestion = (localId) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.length === 1 ? current.questions : current.questions.filter((question) => question.local_id !== localId)
    }))
  }

  const updateBlock = (localId, patch) => {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.local_id === localId ? { ...block, ...patch } : block))
    }))
  }

  const updateBlockContent = (localId, patch) => {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (
        block.local_id === localId
          ? { ...block, content: { ...(block.content || {}), ...patch } }
          : block
      ))
    }))
  }

  const addBlock = () => {
    setForm((current) => ({ ...current, blocks: [...current.blocks, buildBlock(current.blocks.length + 1)] }))
  }

  const insertTemplateBlock = (template) => {
    const templateMap = {
      instruction: {
        block_type: 'text',
        title: 'Instruction block',
        content: {
          text: 'Write the directions, materials allowed, and timing expectations for this part of the paper.',
          layout: { width: 'full', align: 'left', tone: 'plain', page_break_before: false }
        }
      },
      section: {
        block_type: 'section',
        title: 'Section heading',
        content: {
          text: 'Section A: Short answers',
          layout: { width: 'full', align: 'left', tone: 'highlight', page_break_before: false }
        }
      },
      diagram: {
        block_type: 'image',
        title: 'Diagram prompt',
        content: {
          text: 'Insert the visual prompt or the directions that tell students how to use the diagram.',
          caption: 'Figure 1. Refer to the diagram while answering the next question.',
          image_url: '',
          layout: { width: 'wide', align: 'center', tone: 'plain', page_break_before: false }
        }
      }
    }
    const preset = templateMap[template]
    if (!preset) return
    const seededBlock = buildBlock(form.blocks.length + 1)
    setForm((current) => ({
      ...current,
      blocks: [
        ...current.blocks,
        {
          ...seededBlock,
          ...preset,
          content: {
            ...(seededBlock.content || {}),
            ...(preset.content || {})
          }
        }
      ]
    }))
  }

  const removeBlock = (localId) => {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.length === 1 ? current.blocks : current.blocks.filter((block) => block.local_id !== localId)
    }))
  }

  const moveBlock = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return
    setForm((current) => {
      const blocks = [...current.blocks]
      const draggedIndex = blocks.findIndex((block) => block.local_id === draggedId)
      const targetIndex = blocks.findIndex((block) => block.local_id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return current
      const [moved] = blocks.splice(draggedIndex, 1)
      blocks.splice(targetIndex, 0, moved)
      return { ...current, blocks }
    })
  }

  const moveBlockByOffset = (localId, offset) => {
    setForm((current) => {
      const blocks = [...current.blocks]
      const currentIndex = blocks.findIndex((block) => block.local_id === localId)
      if (currentIndex === -1) return current
      const targetIndex = currentIndex + offset
      if (targetIndex < 0 || targetIndex >= blocks.length) return current
      const [moved] = blocks.splice(currentIndex, 1)
      blocks.splice(targetIndex, 0, moved)
      return { ...current, blocks }
    })
  }

  const handleBlockImageUpload = async (localId, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateBlockContent(localId, { image_url: reader.result })
    }
    reader.readAsDataURL(file)
  }

  const buildPayload = () => ({
    title: form.title.trim(),
    description: form.description || null,
    instructions: form.instructions || null,
    exam_mode: form.exam_mode,
    authoring_mode: form.authoring_mode,
    generation_scope: form.generation_scope,
    total_marks: totalMarks,
    duration_minutes: Number(form.duration_minutes),
    available_from: form.available_from ? new Date(form.available_from).toISOString() : null,
    available_until: form.available_until ? new Date(form.available_until).toISOString() : null,
    publish_to_stream: form.publish_to_stream,
    proctoring_enabled: form.proctoring_enabled,
    allow_late_entries: form.allow_late_entries,
    linked_material_ids: form.linked_material_ids,
    grading_notes: form.grading_notes,
    anticheat_policy: form.anticheat_policy,
    blocks: form.blocks.map((block, index) => ({
      block_type: block.block_type,
      title: block.title || null,
      sort_order: index,
      content: block.content || {},
      metadata: {
        layout_hint: block.block_type === 'image' ? 'diagram' : 'standard',
        width: block.content?.layout?.width || 'full',
        align: block.content?.layout?.align || 'left',
        tone: block.content?.layout?.tone || 'plain',
        page_break_before: Boolean(block.content?.layout?.page_break_before)
      }
    })),
    questions: form.questions.map((question, index) => ({
      prompt: question.prompt,
      question_type: question.question_type,
      response_mode: question.response_mode,
      marks: Number(question.marks),
      options: question.question_type === 'mcq' ? question.options.filter((option) => option.text.trim()) : [],
      answer_key: question.answer_key || null,
      grading_keywords: question.grading_keywords.split(',').map((item) => item.trim()).filter(Boolean),
      fixed_response_box: question.fixed_response_box,
      response_config: question.response_config,
      ai_suggestion_context: {
        linked_material_ids: form.linked_material_ids,
        authoring_mode: form.authoring_mode
      },
      position: index
    }))
  })

  const hydrateDraftBlocks = (blocks = []) =>
    blocks.map((block, index) => ({
      local_id: `draft-block-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      block_type: block.block_type || 'text',
      title: block.title || '',
      content: block.content || { text: '' }
    }))

  const hydrateDraftQuestions = (questions = []) =>
    questions.map((question, index) => ({
      local_id: `draft-question-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: question.prompt || '',
      question_type: question.question_type || 'long_text',
      response_mode: question.response_mode || 'typed',
      marks: question.marks || 1,
      answer_key: question.answer_key || '',
      grading_keywords: (question.grading_keywords || []).join(', '),
      fixed_response_box: question.fixed_response_box !== false,
      options: (question.options || []).length
        ? question.options
        : [
            { id: 'A', text: '' },
            { id: 'B', text: '' },
            { id: 'C', text: '' },
            { id: 'D', text: '' }
          ],
      response_config: question.response_config || {
        rows: 6,
        placeholder: 'Students answer in a fixed response box here.'
      }
    }))

  const handleGenerateDraft = async () => {
    if (!form.classroom_id) {
      setError('Choose a classroom before generating an AI exam draft.')
      return
    }
    if (form.generation_scope === 'selected_materials' && form.linked_material_ids.length === 0) {
      setError('Pick at least one linked material before generating an AI exam draft.')
      return
    }

    setDrafting(true)
    setError('')
    setSuccess(null)

    try {
      const payload = await createClassroomExamDraft(token, form.classroom_id, {
        title: form.title || `${selectedClassroom?.name || 'Classroom'} AI draft`,
        instructions: form.instructions || null,
        exam_mode: form.exam_mode,
        generation_scope: form.generation_scope,
        linked_material_ids: form.linked_material_ids,
        num_questions: Math.max(form.questions.length || 0, 4)
      })
      const draft = payload.draft
      setDraftSummary(draft.generation_summary || null)
      setForm((current) => ({
        ...current,
        title: current.title || draft.title || current.title,
        instructions: current.instructions || draft.instructions || current.instructions,
        linked_material_ids: draft.linked_material_ids?.length ? draft.linked_material_ids : current.linked_material_ids,
        blocks: hydrateDraftBlocks(draft.blocks || current.blocks),
        questions: hydrateDraftQuestions(draft.questions || current.questions)
      }))
    } catch (err) {
      setError(err.message || 'Could not generate an AI exam draft.')
    } finally {
      setDrafting(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.classroom_id) {
      setError('Choose a classroom before scheduling the exam.')
      return
    }
    if (!form.title.trim()) {
      setError('Add an exam title before publishing.')
      return
    }
    if (form.questions.some((question) => !question.prompt.trim())) {
      setError('Every exam question needs a prompt.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(null)

    try {
      const payload = await createClassroomExam(token, form.classroom_id, buildPayload())
      setSuccess(payload.exam)
      setForm((current) => ({
        ...current,
        title: '',
        description: '',
        instructions: '',
        available_from: '',
        available_until: '',
        blocks: [buildBlock(1)],
        questions: [buildQuestion(1)]
      }))
    } catch (err) {
      setError(err.message || 'Could not publish classroom exam.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell
      title="Exam Maker"
      eyebrow="Educator assessment studio"
      description="Author mixed exams with a mini document layout, schedule them into classrooms, and attach AI-assisted grading plus anti-cheat review from the same flow."
      actions={
        <>
          <Link href="/educator/anticheat-bot" className="btn btn-outline">Open Anticheat Bot</Link>
          <Link href="/classrooms" className="btn btn-outline">Open Classrooms</Link>
        </>
      }
      contentClassName="space-y-8"
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}
      {success && (
        <div className="rounded-3xl border border-zinc-300 bg-zinc-100 px-5 py-4 text-zinc-800">
          <p className="font-semibold">Exam scheduled in {selectedClassroom?.name || 'the classroom'}.</p>
          <p className="mt-1 text-sm">Students will see it in classwork and the anti-cheat bot will capture review evidence if a protected attempt ends automatically.</p>
          <Link href={`/classrooms/${success.classroom_id}/exam/${success.id}`} className="mt-3 inline-flex text-sm font-semibold text-zinc-900">Open exam detail</Link>
        </div>
      )}

      <AISpotlightBanner
        eyebrow="Assessment AI Surface"
        title="Build a classroom exam that feels authored, not generated."
        description="Use blocks for instructions and diagrams, combine fixed-answer descriptive questions with objective checks, then let AI pre-grade with educator review still in control."
        highlights={['Mini document layout', 'Per-question grading keywords', 'Educator-review anti-cheat endings']}
        primaryAction={{ label: 'Jump to Exam Questions', href: '#exam-question-studio' }}
        secondaryAction={{ label: 'Review Anticheat Policy', href: '#anticheat-policy' }}
        status="The MVP supports mixed authored exams today: manual authoring, AI-aware grading structure, scheduling, and proctored delivery in classrooms."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-[#18181b]">Exam command</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-950">Schedule a proctored classroom exam</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Pick the classroom, define the schedule, then mix descriptive fixed-answer boxes with objective questions and grading keywords for AI-assisted review.
                </p>
              </div>
              <div className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#18181b]">Draft total</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{totalMarks}</p>
                <p className="text-sm text-slate-600">marks</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-900">Classroom</span>
                <select value={form.classroom_id} onChange={(event) => updateForm('classroom_id', event.target.value)} className="input">
                  <option value="">Select classroom</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-900">Authoring mode</span>
                <select value={form.authoring_mode} onChange={(event) => updateForm('authoring_mode', event.target.value)} className="input">
                  <option value="manual">Manual document-style build</option>
                  <option value="ai_assisted">AI-assisted question suggestions</option>
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-900">Exam title</span>
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} className="input" placeholder="Midterm Unit Check - Cell Division and Genetics" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-900">Instructions for students</span>
                <textarea value={form.instructions} onChange={(event) => updateForm('instructions', event.target.value)} className="input min-h-[140px]" placeholder="Explain what materials are allowed, how the exam will be proctored, and how long descriptive answers should be." />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-900">Exam summary</span>
                <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} className="input min-h-[120px]" placeholder="Short classroom-facing summary shown before students begin the attempt." />
              </label>
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker text-[#18181b]">Document layout</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">Mini word-style exam blocks</h3>
              </div>
              <button type="button" onClick={addBlock} className="btn btn-outline inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Block
              </button>
            </div>

            <div className="mt-5 rounded-[28px] border border-dashed border-[#d4d4d8] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="section-kicker text-[#18181b]">Block library</p>
                  <h4 className="mt-2 text-xl font-bold text-slate-950">Quick insert the paper structure</h4>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                    Drop in common exam pieces first, then refine them. This keeps the paper editor feeling more document-like instead of making you author every block from zero.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => insertTemplateBlock('instruction')} className="btn btn-outline">Insert instruction</button>
                  <button type="button" onClick={() => insertTemplateBlock('section')} className="btn btn-outline">Insert section</button>
                  <button type="button" onClick={() => insertTemplateBlock('diagram')} className="btn btn-outline">Insert diagram</button>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {form.blocks.map((block, index) => (
                <div
                  key={block.local_id}
                  draggable
                  onDragStart={() => setDraggedBlockId(block.local_id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    moveBlock(draggedBlockId, block.local_id)
                    setDraggedBlockId('')
                  }}
                  onDragEnd={() => setDraggedBlockId('')}
                  className={`rounded-3xl border bg-[#fafafa] p-5 transition ${
                    draggedBlockId === block.local_id ? 'border-[#f2e9c4] shadow-lg' : 'border-[#d4d4d8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex flex-wrap items-center gap-3">
                      <div className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[#18181b]">Block {index + 1}</div>
                      <div className="rounded-2xl border border-dashed border-[#d4d4d8] bg-[#ffffff] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">
                        Drag to reorder
                      </div>
                      <select
                        value={block.block_type}
                        onChange={(event) => updateBlock(block.local_id, { block_type: event.target.value })}
                        className="input max-w-[220px]"
                      >
                        {BLOCK_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => moveBlockByOffset(block.local_id, -1)} className="rounded-2xl border border-[#d4d4d8] px-3 py-2 text-sm font-semibold text-[#18181b] transition hover:bg-white">
                        Up
                      </button>
                      <button type="button" onClick={() => moveBlockByOffset(block.local_id, 1)} className="rounded-2xl border border-[#d4d4d8] px-3 py-2 text-sm font-semibold text-[#18181b] transition hover:bg-white">
                        Down
                      </button>
                      <button type="button" onClick={() => removeBlock(block.local_id)} className="rounded-2xl border border-[#d4d4d8] p-3 text-[#18181b] transition hover:bg-white">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <input
                      value={block.title}
                      onChange={(event) => updateBlock(block.local_id, { title: event.target.value })}
                      className="input"
                      placeholder={block.block_type === 'image' ? 'Diagram title' : 'Optional block heading'}
                    />
                    <textarea
                      value={block.content.text || ''}
                      onChange={(event) => updateBlockContent(block.local_id, { text: event.target.value })}
                      className="input min-h-[120px]"
                      placeholder={block.block_type === 'image' ? 'Paste a diagram caption, image URL note, or visual instructions for this block.' : 'Write the instructions or section content that should appear before the questions.'}
                    />
                    {block.block_type === 'image' && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-900">Upload diagram</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleBlockImageUpload(block.local_id, event.target.files?.[0] || null)}
                            className="input cursor-pointer file:mr-4 file:rounded-full file:border-0 file:bg-[#c9ab3f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-950"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-900">Image URL fallback</span>
                          <input
                            value={block.content.image_url || ''}
                            onChange={(event) => updateBlockContent(block.local_id, { image_url: event.target.value })}
                            className="input"
                            placeholder="https://..."
                          />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-sm font-semibold text-slate-900">Image caption</span>
                          <input
                            value={block.content.caption || ''}
                            onChange={(event) => updateBlockContent(block.local_id, { caption: event.target.value })}
                            className="input"
                            placeholder="Figure 2. Label the nucleus and mitochondria."
                          />
                        </label>
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-4">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-900">Width</span>
                        <select
                          value={block.content?.layout?.width || 'full'}
                          onChange={(event) => updateBlockContent(block.local_id, {
                            layout: {
                              ...(block.content?.layout || {}),
                              width: event.target.value
                            }
                          })}
                          className="input"
                        >
                          <option value="full">Full width</option>
                          <option value="wide">Wide</option>
                          <option value="half">Half width</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-900">Alignment</span>
                        <select
                          value={block.content?.layout?.align || 'left'}
                          onChange={(event) => updateBlockContent(block.local_id, {
                            layout: {
                              ...(block.content?.layout || {}),
                              align: event.target.value
                            }
                          })}
                          className="input"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-900">Tone</span>
                        <select
                          value={block.content?.layout?.tone || 'plain'}
                          onChange={(event) => updateBlockContent(block.local_id, {
                            layout: {
                              ...(block.content?.layout || {}),
                              tone: event.target.value
                            }
                          })}
                          className="input"
                        >
                          <option value="plain">Plain</option>
                          <option value="highlight">Highlight</option>
                          <option value="examiner">Examiner note</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-[#d4d4d8] bg-white px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(block.content?.layout?.page_break_before)}
                          onChange={(event) => updateBlockContent(block.local_id, {
                            layout: {
                              ...(block.content?.layout || {}),
                              page_break_before: event.target.checked
                            }
                          })}
                        />
                        <span className="text-sm font-semibold text-slate-900">Page break before block</span>
                      </label>
                    </div>
                    {block.block_type === 'image' && block.content?.image_url && (
                      <div className="overflow-hidden rounded-3xl border border-[#d4d4d8] bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">Preview image</p>
                        <img src={block.content.image_url} alt={block.content.caption || block.title || 'Exam diagram preview'} className="mt-4 max-h-72 w-full rounded-2xl object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-[#18181b]">Document preview</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">Preview the educator-facing paper layout</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  This preview mirrors the authored order so the paper feels more like a real exam document instead of a hidden JSON draft.
                </p>
              </div>
              <div className="rounded-3xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-sm font-semibold text-[#18181b]">
                {form.blocks.length} layout blocks
              </div>
            </div>

            <div className="mt-6 space-y-4 rounded-[32px] border border-[#d4d4d8] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="border-b border-dashed border-[#d4d4d8] pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Exam paper</p>
                <h4 className="mt-3 text-3xl font-bold text-slate-950">{form.title || 'Untitled classroom exam'}</h4>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {form.instructions || 'Student instructions will appear here once you write them.'}
                </p>
              </div>

              {form.blocks.map((block, index) => (
                <div
                  key={`preview-${block.local_id}`}
                  className={`rounded-3xl border border-[#d4d4d8] p-5 ${
                    block.content?.layout?.tone === 'highlight'
                      ? 'bg-[#fafafa]'
                      : block.content?.layout?.tone === 'examiner'
                        ? 'bg-[#e4e4e7]'
                        : 'bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{block.block_type}</span>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">
                      {block.content?.layout?.page_break_before ? 'Page break before block' : `Block ${index + 1}`}
                    </span>
                  </div>
                  {block.title && <h5 className="mt-4 text-xl font-bold text-slate-950">{block.title}</h5>}
                  {block.block_type === 'image' && block.content?.image_url ? (
                    <div className="mt-4 space-y-3">
                      <img src={block.content.image_url} alt={block.content.caption || block.title || 'Preview diagram'} className="max-h-72 w-full rounded-2xl object-contain" />
                      <p className="text-sm text-slate-600">{block.content.caption || 'Image caption appears here.'}</p>
                    </div>
                  ) : (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{getPreviewTextForBlock(block)}</p>
                  )}
                </div>
              ))}

              <div className="rounded-3xl border border-dashed border-[#d4d4d8] bg-[#fafafa] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Question flow</p>
                <div className="mt-4 space-y-4">
                  {form.questions.map((question, index) => (
                    <div key={`question-preview-${question.local_id}`} className="rounded-2xl border border-[#d4d4d8] bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="role-pill border-[#d4d4d8] bg-[#fafafa] text-[#3f3f46]">Q{index + 1}</span>
                        <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{question.question_type}</span>
                        <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{question.response_mode}</span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-slate-950">{question.prompt || 'Question prompt preview'}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {question.fixed_response_box ? `Fixed response box: ${question.response_config.rows} rows` : 'Flexible response layout'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-[#d4d4d8] bg-[#fafafa] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#18181b]">Answer box preview</p>
                {!answerBoxPreviewQuestion ? (
                  <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-white p-4 text-sm text-slate-600">
                    Add at least one question to preview the fixed response box layout.
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-[#d4d4d8] bg-white p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="role-pill border-[#d4d4d8] bg-[#fafafa] text-[#3f3f46]">{answerBoxPreviewQuestion.response_mode}</span>
                      <span className="role-pill border-[#d4d4d8] bg-white text-[#3f3f46]">{answerBoxPreviewQuestion.question_type}</span>
                    </div>
                    <p className="mt-3 text-base font-semibold text-slate-950">
                      {answerBoxPreviewQuestion.prompt || 'The selected question prompt will preview here.'}
                    </p>
                    <div
                      className="mt-4 rounded-2xl border border-dashed border-[#d4d4d8] bg-[#ffffff] p-4 text-sm text-slate-500"
                      style={{ minHeight: `${Math.max(Number(answerBoxPreviewQuestion.response_config?.rows || 6), 3) * 28}px` }}
                    >
                      {answerBoxPreviewQuestion.response_mode === 'typed_or_image'
                        ? 'Students can type here or upload an answer image if the educator allows both.'
                        : answerBoxPreviewQuestion.response_mode === 'image_upload'
                          ? 'Students will upload an image response for this question.'
                          : answerBoxPreviewQuestion.response_config?.placeholder || 'Students answer in a fixed response box here.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="exam-question-studio" className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker text-[#18181b]">Question studio</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">Fixed response boxes with AI grading cues</h3>
              </div>
              <button type="button" onClick={addQuestion} className="btn btn-primary inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Question
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {form.questions.map((question, index) => (
                <div key={question.local_id} className="rounded-[28px] border border-[#d4d4d8] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#18181b]">Question {index + 1}</p>
                      <p className="mt-1 text-sm text-slate-600">Educators choose the answer mode per question and define grading keywords for AI review.</p>
                    </div>
                    <button type="button" onClick={() => removeQuestion(question.local_id)} className="rounded-2xl border border-[#d4d4d8] p-3 text-[#18181b] transition hover:bg-[#fafafa]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-900">Prompt</span>
                      <textarea value={question.prompt} onChange={(event) => updateQuestion(question.local_id, { prompt: event.target.value })} className="input min-h-[120px]" placeholder="Write the exact question students should answer." />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-900">Question type</span>
                      <select value={question.question_type} onChange={(event) => updateQuestion(question.local_id, { question_type: event.target.value })} className="input">
                        {QUESTION_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-900">Student response mode</span>
                      <select value={question.response_mode} onChange={(event) => updateQuestion(question.local_id, { response_mode: event.target.value })} className="input">
                        {RESPONSE_MODES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-900">Marks</span>
                      <input type="number" min="1" value={question.marks} onChange={(event) => updateQuestion(question.local_id, { marks: event.target.value })} className="input" />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-900">Fixed answer box rows</span>
                      <input
                        type="number"
                        min="3"
                        value={question.response_config.rows}
                        onChange={(event) => updateQuestion(question.local_id, { response_config: { ...question.response_config, rows: Number(event.target.value) } })}
                        className="input"
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-900">AI grading keywords</span>
                      <input value={question.grading_keywords} onChange={(event) => updateQuestion(question.local_id, { grading_keywords: event.target.value })} className="input" placeholder="Comma-separated key ideas, phrases, or terms the AI should reward." />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-900">Answer key or model answer</span>
                      <textarea value={question.answer_key} onChange={(event) => updateQuestion(question.local_id, { answer_key: event.target.value })} className="input min-h-[120px]" placeholder="Used for AI-assisted review and for educator guidance during manual grading." />
                    </label>
                  </div>

                  {question.question_type === 'mcq' && (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {question.options.map((option) => (
                        <label key={option.id} className="space-y-2">
                          <span className="text-sm font-semibold text-slate-900">Option {option.id}</span>
                          <input value={option.text} onChange={(event) => updateQuestionOption(question.local_id, option.id, event.target.value)} className="input" placeholder={`Option ${option.id}`} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <p className="section-kicker text-[#18181b]">AI suggestion mode</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Material-backed question drafting</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              In AI-assisted mode, the linked materials define what the suggestion layer should pull from when generating draft prompts for the educator to refine.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={drafting || form.authoring_mode !== 'ai_assisted'}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {drafting ? 'Generating draft...' : 'Generate AI Draft'}
              </button>
              {form.authoring_mode !== 'ai_assisted' && (
                <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-sm text-slate-600">
                  Switch authoring mode to AI-assisted to populate the paper from linked material.
                </div>
              )}
            </div>

            {draftSummary && (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <SummaryRow icon={PenSquare} label="Draft questions" value={String(draftSummary.question_count || 0)} />
                <SummaryRow icon={BookOpen} label="Objective" value={String(draftSummary.objective_count || 0)} />
                <SummaryRow icon={FileText} label="Descriptive" value={String(draftSummary.descriptive_count || 0)} />
              </div>
            )}

            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                <input type="radio" name="generation_scope" checked={form.generation_scope === 'selected_materials'} onChange={() => updateForm('generation_scope', 'selected_materials')} className="mt-1" />
                <div>
                  <p className="font-semibold text-slate-950">Use selected materials only</p>
                  <p className="mt-1 text-sm text-slate-600">Best when this exam should stay tightly aligned to the exact revision pack.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                <input type="radio" name="generation_scope" checked={form.generation_scope === 'classroom_materials'} onChange={() => updateForm('generation_scope', 'classroom_materials')} className="mt-1" />
                <div>
                  <p className="font-semibold text-slate-950">Use all classroom materials</p>
                  <p className="mt-1 text-sm text-slate-600">Best when the exam should synthesize across everything already shared in class.</p>
                </div>
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d4d4d8] bg-[#fafafa] p-4 text-sm text-slate-600">Upload materials first so AI-assisted exam suggestions can target them.</div>
              ) : (
                documents.map((document) => (
                  <label key={document.id} className="flex items-start gap-3 rounded-2xl border border-[#d4d4d8] bg-white p-4">
                    <input type="checkbox" checked={form.linked_material_ids.includes(document.id)} onChange={() => toggleLinkedMaterial(document.id)} className="mt-1" />
                    <div>
                      <p className="font-semibold text-slate-950">{document.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{document.file_name}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </section>

          <section id="anticheat-policy" className="card p-6">
            <p className="section-kicker text-[#18181b]">Anticheat policy</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Educator-review endings, not silent failures</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                Major warnings capture a snapshot and append it to the anti-cheat case.
              </div>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                If the attempt is ended automatically, the final outcome becomes educator review required.
              </div>
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                The anti-cheat bot keeps the final debarred case plus the last three evidence snapshots.
              </div>
            </div>
          </section>

          <section className="card p-6">
            <p className="section-kicker text-[#18181b]">Exam readiness</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">What this draft will publish</h3>
            <div className="mt-5 grid gap-3">
              <SummaryRow icon={PenSquare} label="Questions" value={`${form.questions.length} authored`} />
              <SummaryRow icon={BookOpen} label="Materials" value={`${linkedDocumentObjects.length} linked`} />
              <SummaryRow icon={TimerReset} label="Duration" value={`${form.duration_minutes} min`} />
              <SummaryRow icon={Shield} label="Protection" value={form.proctoring_enabled ? 'AI proctored' : 'Standard attempt'} />
              <SummaryRow icon={Sparkles} label="Drafting" value={form.authoring_mode === 'ai_assisted' ? 'AI-assisted' : 'Manual'} />
              <SummaryRow icon={FileImage} label="Layout blocks" value={`${form.blocks.length} blocks`} />
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary mt-6 w-full">
              {saving ? 'Scheduling exam...' : 'Schedule Classroom Exam'}
            </button>
          </section>
        </div>
      </form>
    </AppShell>
  )
}

function SummaryRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-3">
      <div className="inline-flex items-center gap-3 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-[#18181b]" />
        {label}
      </div>
      <span className="text-sm text-slate-600">{value}</span>
    </div>
  )
}
