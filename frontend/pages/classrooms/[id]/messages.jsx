import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import ClassroomShell from '../../../components/ClassroomShell'
import ClassroomThreadPane from '../../../components/ClassroomThreadPane'
import { useAuth } from '../../../context/AuthContext'
import { normalizeClassroomId, shouldApplyClassroomResponse } from '../../../lib/classroomRouteState'
import {
  createClassroomThread,
  getClassroom,
  getClassroomPeople,
  getClassroomThread,
  listClassroomThreads,
  postClassroomThreadMessage
} from '../../../lib/classroomApi'

export default function ClassroomMessagesPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [threads, setThreads] = useState([])
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState([])
  const [activeThreadId, setActiveThreadId] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState('')
  const pageRequestSequence = useRef(0)
  const messageRequestSequence = useRef(0)
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

  useEffect(() => {
    if (!activeThreadId || !classroomId) return
    loadMessages(classroomId, activeThreadId)
  }, [activeThreadId, classroomId])

  const loadPage = async (requestedId) => {
    const requestId = ++pageRequestSequence.current
    setLoading(true)
    setError('')
    try {
      const [classroomPayload, threadPayload, peoplePayload] = await Promise.all([
        getClassroom(token, requestedId),
        listClassroomThreads(token, requestedId),
        getClassroomPeople(token, requestedId)
      ])
      if (pageRequestSequence.current !== requestId || !shouldApplyClassroomResponse(requestedId, classroomPayload.classroom?.id)) {
        return
      }
      setClassroom(classroomPayload.classroom)
      setThreads(threadPayload.threads || [])
      const availableContacts = user?.role === 'student' ? (peoplePayload.educators || []) : (peoplePayload.students || [])
      setContacts(availableContacts)

      const firstThreadId = threadPayload.threads?.[0]?.id || ''
      if (firstThreadId) {
        setActiveThreadId(firstThreadId)
      } else if (user?.role === 'student' && availableContacts.length > 0) {
        const threadResponse = await createClassroomThread(token, requestedId, {})
        if (pageRequestSequence.current !== requestId) {
          return
        }
        setActiveThreadId(threadResponse.thread_id)
        const refreshedThreads = await listClassroomThreads(token, requestedId)
        if (pageRequestSequence.current !== requestId) {
          return
        }
        setThreads(refreshedThreads.threads || [])
      }
    } catch (err) {
      if (pageRequestSequence.current === requestId) {
        setError(err.message || 'Could not load classroom messages')
      }
    } finally {
      if (pageRequestSequence.current === requestId) {
        setLoading(false)
      }
    }
  }

  const loadMessages = async (requestedClassroomId, threadId) => {
    const requestId = ++messageRequestSequence.current
    setMessagesLoading(true)
    setError('')
    try {
      const payload = await getClassroomThread(token, requestedClassroomId, threadId)
      if (messageRequestSequence.current !== requestId) {
        return
      }
      setMessages(payload.messages || [])
    } catch (err) {
      if (messageRequestSequence.current === requestId) {
        setError(err.message || 'Could not load thread')
      }
    } finally {
      if (messageRequestSequence.current === requestId) {
        setMessagesLoading(false)
      }
    }
  }

  const handleCreateThread = async (recipientId) => {
    setError('')
    try {
      const payload = await createClassroomThread(token, classroomId, recipientId ? { recipient_id: recipientId } : {})
      const refreshedThreads = await listClassroomThreads(token, classroomId)
      setThreads(refreshedThreads.threads || [])
      setActiveThreadId(payload.thread_id)
    } catch (err) {
      setError(err.message || 'Could not open thread')
    }
  }

  const handleSend = async (content) => {
    setError('')
    try {
      await postClassroomThreadMessage(token, classroomId, activeThreadId, { content })
      await loadMessages(classroomId, activeThreadId)
      const refreshedThreads = await listClassroomThreads(token, classroomId)
      setThreads(refreshedThreads.threads || [])
    } catch (err) {
      setError(err.message || 'Could not send message')
    }
  }

  return (
    <ClassroomShell classroom={classroom} activeTab="messages" isLoading={loading} error={error}>
      <ClassroomThreadPane
        threads={threads}
        messages={messages}
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
        onSendMessage={handleSend}
        onCreateThread={handleCreateThread}
        contacts={contacts}
        role={user?.role || 'student'}
        loading={messagesLoading}
      />
    </ClassroomShell>
  )
}
