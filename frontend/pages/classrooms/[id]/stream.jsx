import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Pin, Video } from 'lucide-react'
import { useRouter } from 'next/router'

import ClassroomShell from '../../../components/ClassroomShell'
import ClassroomStreamComposer from '../../../components/ClassroomStreamComposer'
import { useAuth } from '../../../context/AuthContext'
import { normalizeClassroomId, shouldApplyClassroomResponse } from '../../../lib/classroomRouteState'
import { createClassroomAnnouncement, getClassroom, getClassroomStream } from '../../../lib/classroomApi'

export default function ClassroomStreamPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
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
      const [classroomPayload, streamPayload] = await Promise.all([
        getClassroom(token, requestedId),
        getClassroomStream(token, requestedId)
      ])
      if (requestSequence.current !== requestId || !shouldApplyClassroomResponse(requestedId, classroomPayload.classroom?.id)) {
        return
      }
      setClassroom(classroomPayload.classroom)
      setPosts(streamPayload.posts || [])
    } catch (err) {
      if (requestSequence.current === requestId) {
        setError(err.message || 'Could not load classroom stream')
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
      }
    }
  }

  const handleCreatePost = async (payload) => {
    setSubmitting(true)
    setError('')
    try {
      await createClassroomAnnouncement(token, classroomId, payload)
      await loadPage(classroomId)
    } catch (err) {
      setError(err.message || 'Could not post announcement')
    } finally {
      setSubmitting(false)
    }
  }

  const canPost = ['educator', 'admin'].includes(user?.role)

  return (
    <ClassroomShell classroom={classroom} activeTab="stream" isLoading={loading} error={error}>
      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="card p-6">
            <p className="section-kicker text-[#8a5a36]">About this stream</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Public classroom updates live here.</h3>
            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <div className="surface-subtle p-4">Announcements posted here are visible to the whole classroom.</div>
              <div className="surface-subtle p-4">Material and live-session notices can be pinned to keep students aligned.</div>
              <div className="surface-subtle p-4">Students use this page to keep up with class-wide direction before switching to private messages.</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {canPost && <ClassroomStreamComposer onSubmit={handleCreatePost} isSubmitting={submitting} />}

          {posts.length === 0 ? (
            <div className="card p-6 text-slate-600">No stream posts yet.</div>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="card overflow-hidden">
                <div className="border-b border-stone-200/80 px-6 py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {post.is_pinned && (
                          <span className="role-pill border-[#d8c1aa] bg-[#f5ebdf] text-[#6d472d]">
                            <Pin className="mr-1 h-3.5 w-3.5" />
                            Pinned
                          </span>
                        )}
                        <span className="role-pill border-stone-200 bg-stone-50 text-stone-700">{post.post_type}</span>
                      </div>
                      <h3 className="mt-4 text-2xl font-bold text-slate-950">{post.title || 'Class update'}</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {post.author?.name} • {new Date(post.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 px-6 py-5">
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{post.content}</p>

                  {post.document && (
                    <Link href={`/document/${post.document.id}`} className="surface-subtle block p-4 transition hover:border-[#d6b393]">
                      <p className="text-sm font-semibold text-slate-950">{post.document.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{post.document.file_name}</p>
                    </Link>
                  )}

                  {post.live_session && (
                    <div className="surface-subtle p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#6d472d]">
                            <Video className="h-4 w-4" />
                            {post.live_session.title}
                          </p>
                          {post.live_session.scheduled_for && (
                            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                              <CalendarDays className="h-4 w-4 text-[#8a5a36]" />
                              {new Date(post.live_session.scheduled_for).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Link href={`/classrooms/${classroomId}/live`} className="btn btn-outline">
                          Open live page
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </ClassroomShell>
  )
}
