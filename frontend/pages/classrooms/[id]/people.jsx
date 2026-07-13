import React, { useEffect, useRef, useState } from 'react'
import { GraduationCap, School2 } from 'lucide-react'
import { useRouter } from 'next/router'

import ClassroomShell from '../../../components/ClassroomShell'
import { useAuth } from '../../../context/AuthContext'
import { normalizeClassroomId, shouldApplyClassroomResponse } from '../../../lib/classroomRouteState'
import { getClassroom, getClassroomPeople } from '../../../lib/classroomApi'

export default function ClassroomPeoplePage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [educators, setEducators] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)
  const classroomId = normalizeClassroomId(typeof router.query.id === 'string' ? router.query.id : '', classroom)

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!classroomId) return
    loadPage(classroomId)
  }, [authLoading, token, router.isReady, classroomId])

  const loadPage = async (requestedId) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, peoplePayload] = await Promise.all([
        getClassroom(token, requestedId),
        getClassroomPeople(token, requestedId)
      ])
      if (requestSequence.current !== requestId || !shouldApplyClassroomResponse(requestedId, classroomPayload.classroom?.id)) {
        return
      }
      setClassroom(classroomPayload.classroom)
      setEducators(peoplePayload.educators || [])
      setStudents(peoplePayload.students || [])
    } catch (err) {
      if (requestSequence.current === requestId) {
        setError(err.message || 'Could not load classroom people')
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
      }
    }
  }

  return (
    <ClassroomShell classroom={classroom} activeTab="people" isLoading={loading} error={error}>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <School2 className="h-5 w-5 text-[#18181b]" />
            <div>
              <p className="section-kicker text-[#18181b]">Educators</p>
              <h3 className="text-2xl font-bold text-slate-950">Who leads this classroom</h3>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {educators.map((educator) => (
              <div key={educator.id} className="surface-quiet p-4">
                <p className="text-lg font-semibold text-slate-950">{educator.full_name}</p>
                <p className="mt-2 text-sm text-slate-600">{educator.email}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-[#18181b]" />
            <div>
              <p className="section-kicker text-[#18181b]">Students</p>
              <h3 className="text-2xl font-bold text-slate-950">Class roster</h3>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {students.length === 0 ? (
              <div className="surface-subtle p-4 text-sm text-slate-600">No students enrolled yet.</div>
            ) : (
              students.map((student) => (
                <div key={student.id} className="surface-quiet p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{student.full_name}</p>
                      <p className="mt-1 text-sm text-slate-600">{student.email}</p>
                    </div>
                    <p className="text-sm text-slate-500">
                      Joined {new Date(student.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </ClassroomShell>
  )
}
