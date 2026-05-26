import React, { useEffect, useMemo, useState } from 'react'
import { Bell, PlusCircle, School2, UserPlus } from 'lucide-react'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import ClassroomCardGrid from '../../components/ClassroomCardGrid'
import { useAuth } from '../../context/AuthContext'
import {
  createEducatorClassroom,
  joinClassroom,
  listClassrooms,
  listNotifications
} from '../../lib/classroomApi'

export default function ClassroomsHomePage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classrooms, setClassrooms] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [classroomForm, setClassroomForm] = useState({ name: '', subject: 'Biology', description: '' })

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    loadPage()
  }, [authLoading, token, router])

  const loadPage = async () => {
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, notificationPayload] = await Promise.all([
        listClassrooms(token),
        listNotifications(token)
      ])
      setClassrooms(classroomPayload.classrooms || [])
      setNotifications(notificationPayload.notifications || [])
    } catch (err) {
      setError(err.message || 'Could not load classrooms')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const normalizedCode = joinCode.trim().toUpperCase()
      if (!normalizedCode) {
        throw new Error('Enter a valid classroom invite code')
      }
      const payload = await joinClassroom(token, normalizedCode)
      setSuccess(payload.message || 'Joined classroom successfully.')
      setJoinCode('')
      await router.push(`/classrooms/${payload.classroom_id}/stream`)
    } catch (err) {
      setError(err.message || 'Could not join classroom')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createEducatorClassroom(token, classroomForm)
      setSuccess('Classroom created.')
      setClassroomForm({ name: '', subject: 'Biology', description: '' })
      await loadPage()
    } catch (err) {
      setError(err.message || 'Could not create classroom')
    } finally {
      setSaving(false)
    }
  }

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.is_read).slice(0, 6),
    [notifications]
  )

  const role = user?.role || 'student'

  return (
    <AppShell
      title="Classrooms"
      eyebrow={role === 'student' ? 'Student classroom home' : 'Educator classroom home'}
      description="Browse your classroom spaces first, then step into a dedicated Stream, Classwork, People, Messages, and Live workflow for each class."
      contentClassName="space-y-8"
    >
      {(error || success) && (
        <div className="space-y-3">
          {error && <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
          {success && <div className="rounded-[18px] border border-[#d8c1aa] bg-[#f5ebdf] px-4 py-3 text-[#6d472d]">{success}</div>}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="section-kicker text-[#8a5a36]">Classroom list</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-950">Choose where you want to work.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Enter through your class list first, then open a dedicated workspace for announcements, classwork, people, messages, and live sessions.
                </p>
              </div>
              <div className="rounded-full bg-[#f5ebdf] px-4 py-2 text-sm font-semibold text-[#6d472d]">
                {classrooms.length} classroom{classrooms.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card p-6 text-slate-600">Loading classrooms...</div>
          ) : (
            <ClassroomCardGrid classrooms={classrooms} role={role} />
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#f5ebdf] p-3 text-[#6d472d]">
                {role === 'student' ? <UserPlus className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
              </div>
              <div>
                <p className="section-kicker text-[#8a5a36]">{role === 'student' ? 'Join' : 'Create'}</p>
                <h3 className="text-2xl font-bold text-slate-950">{role === 'student' ? 'Enter a class invite code' : 'Start a new classroom'}</h3>
              </div>
            </div>

            {role === 'student' ? (
              <form onSubmit={handleJoin} className="mt-5 space-y-4">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  className="input"
                  placeholder="Invite code"
                  required
                />
                <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                  {saving ? 'Joining...' : 'Join classroom'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreate} className="mt-5 space-y-4">
                <input
                  value={classroomForm.name}
                  onChange={(event) => setClassroomForm((current) => ({ ...current, name: event.target.value }))}
                  className="input"
                  placeholder="Classroom name"
                  required
                />
                <input
                  value={classroomForm.subject}
                  onChange={(event) => setClassroomForm((current) => ({ ...current, subject: event.target.value }))}
                  className="input"
                  placeholder="Subject"
                  required
                />
                <textarea
                  value={classroomForm.description}
                  onChange={(event) => setClassroomForm((current) => ({ ...current, description: event.target.value }))}
                  className="input min-h-[120px]"
                  placeholder="Class description"
                />
                <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                  {saving ? 'Creating...' : 'Create classroom'}
                </button>
              </form>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#f5ebdf] p-3 text-[#6d472d]">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="section-kicker text-[#8a5a36]">Notifications</p>
                <h3 className="text-2xl font-bold text-slate-950">Classroom activity</h3>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {unreadNotifications.length === 0 ? (
                <div className="surface-subtle p-4 text-sm text-slate-600">No unread classroom notifications right now.</div>
              ) : (
                unreadNotifications.map((notification) => (
                  <div key={notification.id} className="surface-quiet p-4">
                    <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{notification.body}</p>
                    <p className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8a5a36]">
                      <School2 className="h-3.5 w-3.5" />
                      {notification.classroom_name || 'Classroom'} • {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
