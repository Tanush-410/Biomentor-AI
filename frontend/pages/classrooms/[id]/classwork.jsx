import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { CalendarDays, Camera, FileText, PlusCircle } from 'lucide-react'
import { useRouter } from 'next/router'

import ClassroomIntelligencePanel from '../../../components/ClassroomIntelligencePanel'
import ClassroomShell from '../../../components/ClassroomShell'
import { useAuth } from '../../../context/AuthContext'
import { normalizeListPayload } from '../../../lib/backendApi'
import { normalizeClassroomId, shouldApplyClassroomResponse } from '../../../lib/classroomRouteState'
import {
  createClassroomAssignment,
  getClassroom,
  getClassroomIntelligence,
  getClasswork,
  listClassroomExams,
  listDocuments,
  shareClassroomMaterial
} from '../../../lib/classroomApi'

export default function ClassroomClassworkPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [materials, setMaterials] = useState([])
  const [assignments, setAssignments] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [certifications, setCertifications] = useState([])
  const [exams, setExams] = useState([])
  const [documents, setDocuments] = useState([])
  const [intelligence, setIntelligence] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const requestSequence = useRef(0)
  const classroomId = normalizeClassroomId(typeof router.query.id === 'string' ? router.query.id : '', classroom)
  const [materialForm, setMaterialForm] = useState({ document_id: '', title_override: '', description: '' })
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    assignment_type: 'task',
    document_id: '',
    quiz_reference: '',
    due_at: ''
  })

  const loadPage = useCallback(async (requestedId) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const requests = [
        getClassroom(token, requestedId),
        getClasswork(token, requestedId),
        getClassroomIntelligence(token, requestedId),
        listClassroomExams(token, requestedId)
      ]
      if (['educator', 'admin'].includes(user?.role)) {
        requests.push(listDocuments(token))
      }
      const [classroomPayload, classworkPayload, intelligencePayload, examPayload, documentPayload] = await Promise.all(requests)
      if (requestSequence.current !== requestId || !shouldApplyClassroomResponse(requestedId, classroomPayload.classroom?.id)) {
        return
      }
      setClassroom(classroomPayload.classroom)
      setMaterials(classworkPayload.materials || [])
      setAssignments(classworkPayload.assignments || [])
      setQuizzes(classworkPayload.quizzes || [])
      setCertifications(classworkPayload.certifications || [])
      setExams(examPayload.exams || [])
      setIntelligence(intelligencePayload)
      const nextDocuments = normalizeListPayload(documentPayload, 'documents')
      setDocuments(nextDocuments)
      if (nextDocuments.length > 0) {
        setMaterialForm((current) => ({ ...current, document_id: current.document_id || nextDocuments[0].id }))
        setAssignmentForm((current) => ({ ...current, document_id: current.document_id || nextDocuments[0].id }))
      }
    } catch (err) {
      if (requestSequence.current === requestId) {
        setError(err.message || 'Could not load classwork')
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
      }
    }
  }, [token, user?.role])

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!classroomId) return
    loadPage(classroomId)
  }, [authLoading, loadPage, router.isReady, router, classroomId])

  

  const handleShareMaterial = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await shareClassroomMaterial(token, classroomId, materialForm)
      setMaterialForm((current) => ({ ...current, title_override: '', description: '' }))
      await loadPage(classroomId)
    } catch (err) {
      setError(err.message || 'Could not share material')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAssignment = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createClassroomAssignment(token, classroomId, {
        ...assignmentForm,
        due_at: assignmentForm.due_at || null,
        document_id: assignmentForm.document_id || null,
        quiz_reference: assignmentForm.quiz_reference || null
      })
      setAssignmentForm((current) => ({
        ...current,
        title: '',
        description: '',
        quiz_reference: '',
        due_at: ''
      }))
      await loadPage(classroomId)
    } catch (err) {
      setError(err.message || 'Could not create assignment')
    } finally {
      setSaving(false)
    }
  }

  const canManage = ['educator', 'admin'].includes(user?.role)

  return (
    <ClassroomShell classroom={classroom} activeTab="classwork" isLoading={loading} error={error}>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ClassroomIntelligencePanel intelligence={intelligence} role={user?.role} variant="classwork" />
          <div className="card p-6">
            <p className="section-kicker text-[#18181b]">Classwork board</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Materials, tasks, quizzes, and due dates.</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Keep study resources, assignments, and quiz references organized in one focused classwork space.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker text-[#18181b]">Materials</p>
                  <h4 className="mt-2 text-xl font-bold text-slate-950">Shared study resources</h4>
                </div>
                <div className="rounded-full bg-[#e4e4e7] px-3 py-2 text-sm font-semibold text-[#3f3f46]">{materials.length}</div>
              </div>
              <div className="mt-5 space-y-4">
                {materials.length === 0 ? (
                  <div className="surface-subtle p-4 text-sm text-slate-600">No classroom materials yet.</div>
                ) : (
                  materials.map((material) => (
                    <Link key={material.id} href={`/document/${material.document_id}`} className="surface-quiet block p-4 transition hover:border-[#f2e9c4]">
                      <p className="text-sm font-semibold text-slate-950">{material.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{material.file_name}</p>
                      {material.description && <p className="mt-3 text-sm leading-6 text-slate-600">{material.description}</p>}
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker text-[#18181b]">Assignments</p>
                  <h4 className="mt-2 text-xl font-bold text-slate-950">Tasks and quizzes</h4>
                </div>
                <div className="rounded-full bg-[#e4e4e7] px-3 py-2 text-sm font-semibold text-[#3f3f46]">{assignments.length}</div>
              </div>
              <div className="mt-5 space-y-4">
                {assignments.length === 0 ? (
                  <div className="surface-subtle p-4 text-sm text-slate-600">No classwork items yet.</div>
                ) : (
                  assignments.map((assignment) => (
                    <div key={assignment.id} className="surface-quiet p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{assignment.assignment_type}</span>
                        {assignment.due_at && (
                          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                            <CalendarDays className="h-4 w-4 text-[#18181b]" />
                            {new Date(assignment.due_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <h5 className="mt-4 text-lg font-semibold text-slate-950">{assignment.title}</h5>
                      {assignment.description && <p className="mt-2 text-sm leading-6 text-slate-600">{assignment.description}</p>}
                      {assignment.document && (
                        <Link href={`/document/${assignment.document.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3f3f46]">
                          <FileText className="h-4 w-4" />
                          Open linked material
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker text-[#18181b]">Published quizzes</p>
                <h4 className="mt-2 text-xl font-bold text-slate-950">Scheduled and proctored classroom assessments</h4>
              </div>
              <div className="rounded-full bg-[#e4e4e7] px-3 py-2 text-sm font-semibold text-[#3f3f46]">{quizzes.length}</div>
            </div>
            <div className="mt-5 space-y-4">
              {quizzes.length === 0 ? (
                <div className="surface-subtle p-4 text-sm text-slate-600">No classroom quizzes have been published yet.</div>
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz.id} className="surface-quiet p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{quiz.availability_state}</span>
                      <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 text-[#18181b]" />
                        {quiz.available_from ? new Date(quiz.available_from).toLocaleString() : 'Available now'}
                      </span>
                      {quiz.proctoring_enabled && (
                        <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                          <Camera className="h-4 w-4 text-[#18181b]" />
                          Proctored
                        </span>
                      )}
                    </div>
                    <h5 className="mt-4 text-lg font-semibold text-slate-950">{quiz.title}</h5>
                    {quiz.description && <p className="mt-2 text-sm leading-6 text-slate-600">{quiz.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span>{quiz.num_questions} questions</span>
                      <span>{quiz.duration_minutes} min</span>
                      {quiz.document?.title && <span>{quiz.document.title}</span>}
                    </div>
                    <div className="mt-4">
                      <Link href={`/classrooms/${classroomId}/quiz/${quiz.id}`} className="btn btn-outline">
                        {canManage ? 'Open Quiz Details' : quiz.can_start ? 'Start Quiz' : 'View Quiz'}
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker text-[#18181b]">Certification paths</p>
                <h4 className="mt-2 text-xl font-bold text-slate-950">Completion tracks and classroom certificates</h4>
              </div>
              <div className="rounded-full bg-[#e4e4e7] px-3 py-2 text-sm font-semibold text-[#3f3f46]">{certifications.length}</div>
            </div>
            <div className="mt-5 space-y-4">
              {certifications.length === 0 ? (
                <div className="surface-subtle p-4 text-sm text-slate-600">
                  No certification tracks have been published yet.
                </div>
              ) : (
                certifications.map((certification) => (
                  <div key={certification.id} className="surface-quiet p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{certification.course_mode === 'external_course' ? 'External + VYDRA CORE' : 'VYDRA CORE track'}</span>
                      <span className="role-pill border-[#d4d4d8] bg-white text-slate-600">{certification.status}</span>
                      {certification.viewer_progress?.status ? (
                        <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                          {Math.round(certification.viewer_progress.completion_percentage || 0)}% complete
                        </span>
                      ) : null}
                    </div>
                    <h5 className="mt-4 text-lg font-semibold text-slate-950">{certification.title}</h5>
                    {certification.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{certification.description}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span>{certification.steps?.length || 0} milestones</span>
                      {certification.provider_name ? <span>{certification.provider_name}</span> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/classrooms/${classroomId}/certification/${certification.id}`} className="btn btn-outline">
                        {canManage ? 'Manage certification' : 'Open certification'}
                      </Link>
                      {canManage ? (
                        <Link href="/educator/certification" className="btn btn-outline">
                          Open Certification Studio
                        </Link>
                      ) : null}
                      {certification.viewer_progress?.issued_certificate_id ? (
                        <Link href={`/certificate/${certification.viewer_progress.issued_certificate_id}`} className="btn btn-outline">
                          View certificate
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker text-[#18181b]">Published exams</p>
                <h4 className="mt-2 text-xl font-bold text-slate-950">Mixed-response protected assessments</h4>
              </div>
              <div className="rounded-full bg-[#e4e4e7] px-3 py-2 text-sm font-semibold text-[#3f3f46]">{exams.length}</div>
            </div>
            <div className="mt-5 space-y-4">
              {exams.length === 0 ? (
                <div className="surface-subtle p-4 text-sm text-slate-600">No classroom exams have been scheduled yet.</div>
              ) : (
                exams.map((exam) => (
                  <div key={exam.id} className="surface-quiet p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">{exam.status}</span>
                      <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 text-[#18181b]" />
                        {exam.available_from ? new Date(exam.available_from).toLocaleString() : 'Available now'}
                      </span>
                      {exam.proctoring_enabled && (
                        <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                          <Camera className="h-4 w-4 text-[#18181b]" />
                          Proctored
                        </span>
                      )}
                    </div>
                    <h5 className="mt-4 text-lg font-semibold text-slate-950">{exam.title}</h5>
                    {exam.description && <p className="mt-2 text-sm leading-6 text-slate-600">{exam.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span>{exam.questions?.length || 0} questions</span>
                      <span>{exam.duration_minutes} min</span>
                      <span>{exam.total_marks} marks</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/classrooms/${classroomId}/exam/${exam.id}`} className="btn btn-outline">
                          {canManage ? 'Open Exam Details' : 'Open Exam'}
                        </Link>
                        {canManage && (
                          <>
                            <Link href={`/educator/exam-review/${exam.id}?classroomId=${classroomId}`} className="btn btn-outline">
                              Open grading desk
                            </Link>
                            <Link href="/educator/anticheat-bot" className="btn btn-outline">
                              Anti-cheat review
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="space-y-6">
            <form onSubmit={handleShareMaterial} className="card p-6">
              <div className="flex items-center gap-3">
                <PlusCircle className="h-5 w-5 text-[#18181b]" />
                <div>
                  <p className="section-kicker text-[#18181b]">Share material</p>
                  <h3 className="text-2xl font-bold text-slate-950">Add a resource</h3>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <select value={materialForm.document_id} onChange={(event) => setMaterialForm((current) => ({ ...current, document_id: event.target.value }))} className="input" required>
                  <option value="">Select uploaded material</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>{document.title}</option>
                  ))}
                </select>
                <input value={materialForm.title_override} onChange={(event) => setMaterialForm((current) => ({ ...current, title_override: event.target.value }))} className="input" placeholder="Optional display title" />
                <textarea value={materialForm.description} onChange={(event) => setMaterialForm((current) => ({ ...current, description: event.target.value }))} className="input min-h-[110px]" placeholder="What should students know before opening this?" />
                <button type="submit" className="btn btn-outline w-full" disabled={saving || !documents.length}>Share material</button>
              </div>
            </form>

            <form onSubmit={handleCreateAssignment} className="card p-6">
              <p className="section-kicker text-[#18181b]">Add classwork</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950">Create a task or quiz prompt.</h3>
              <div className="mt-5 space-y-4">
                <input value={assignmentForm.title} onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))} className="input" placeholder="Task title" required />
                <textarea value={assignmentForm.description} onChange={(event) => setAssignmentForm((current) => ({ ...current, description: event.target.value }))} className="input min-h-[120px]" placeholder="Task instructions" />
                <select value={assignmentForm.assignment_type} onChange={(event) => setAssignmentForm((current) => ({ ...current, assignment_type: event.target.value }))} className="input">
                  <option value="task">Task</option>
                  <option value="quiz">Quiz</option>
                  <option value="exam">Exam</option>
                  <option value="material-review">Material review</option>
                </select>
                <select value={assignmentForm.document_id} onChange={(event) => setAssignmentForm((current) => ({ ...current, document_id: event.target.value }))} className="input">
                  <option value="">Optional linked material</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>{document.title}</option>
                  ))}
                </select>
                <input value={assignmentForm.quiz_reference} onChange={(event) => setAssignmentForm((current) => ({ ...current, quiz_reference: event.target.value }))} className="input" placeholder="Optional quiz reference label" />
                <input value={assignmentForm.due_at} onChange={(event) => setAssignmentForm((current) => ({ ...current, due_at: event.target.value }))} type="datetime-local" className="input" />
                <button type="submit" className="btn btn-primary w-full" disabled={saving}>Create classwork</button>
                <Link href="/educator/quiz-maker" className="btn btn-outline w-full text-center">Open full Quiz Maker</Link>
                <Link href="/educator/exam-maker" className="btn btn-outline w-full text-center">Open full Exam Maker</Link>
              </div>
            </form>
          </div>
        )}
      </section>
    </ClassroomShell>
  )
}
