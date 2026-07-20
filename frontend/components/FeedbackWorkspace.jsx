import React, { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Send, Star, Trash2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'teaching_quality', label: 'Teaching quality' },
  { value: 'class_pace', label: 'Class pace' },
  { value: 'materials', label: 'Materials' },
  { value: 'communication', label: 'Communication' },
  { value: 'participation', label: 'Participation' }
]

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((option) => [option.value, option.label]))

function targetKey(target) {
  return `${target.classroom_id}::${target.user_id}`
}

function StarRating({ value, onChange, readOnly = false }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star === value ? null : star)}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer'} p-0.5`}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            className={`h-5 w-5 ${value && star <= value ? 'fill-[#d9c25c] text-[#a88a26]' : 'text-zinc-300'}`}
          />
        </button>
      ))}
    </div>
  )
}

function FeedbackCard({ item, viewerRole, onDelete }) {
  const isSent = viewerRole === 'sent'
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {isSent ? `To ${item.to_user_name || 'Unknown'}` : (item.from_user_name || 'Anonymous')}
          </p>
          <p className="text-xs text-zinc-500">{item.classroom_name || 'Unknown classroom'}</p>
        </div>
        <div className="flex items-center gap-3">
          {item.rating ? <StarRating value={item.rating} readOnly /> : null}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="text-zinc-400 transition hover:text-red-600"
              aria-label="Remove feedback"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{item.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">
          {CATEGORY_LABELS[item.category] || 'General'}
        </span>
        {item.is_anonymous && <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">Anonymous</span>}
        <span>{new Date(item.created_at).toLocaleString()}</span>
      </div>
    </div>
  )
}

export default function FeedbackWorkspace() {
  const { token, user } = useAuth()
  const isStudent = user?.role === 'student'

  const [targets, setTargets] = useState([])
  const [received, setReceived] = useState(null)
  const [sent, setSent] = useState([])
  const [classroomFilter, setClassroomFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedTarget, setSelectedTarget] = useState('')
  const [rating, setRating] = useState(null)
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadAll = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [targetsPayload, receivedPayload, sentPayload] = await Promise.all([
        requestBackendJson('/feedback/targets', { headers: authHeaders }),
        requestBackendJson('/feedback/received', { headers: authHeaders }),
        requestBackendJson('/feedback/sent', { headers: authHeaders })
      ])
      setTargets(targetsPayload.targets || [])
      setReceived(receivedPayload)
      setSent(sentPayload.feedback || [])
    } catch (err) {
      setError(err.message || 'Could not load feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const reloadReceived = async (nextClassroomFilter = classroomFilter) => {
    try {
      const path = nextClassroomFilter
        ? `/feedback/received?classroom_id=${encodeURIComponent(nextClassroomFilter)}`
        : '/feedback/received'
      const payload = await requestBackendJson(path, { headers: authHeaders })
      setReceived(payload)
    } catch (err) {
      setError(err.message || 'Could not load received feedback.')
    }
  }

  const handleClassroomFilterChange = async (value) => {
    setClassroomFilter(value)
    await reloadReceived(value)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    setSubmitSuccess('')

    const target = targets.find((candidate) => targetKey(candidate) === selectedTarget)
    if (!target) {
      setSubmitError('Pick who this feedback is for.')
      return
    }
    if (!message.trim()) {
      setSubmitError('Write a message before sending.')
      return
    }

    setSubmitting(true)
    try {
      await requestBackendJson('/feedback/submit', {
        method: 'POST',
        headers: authHeaders,
        body: {
          classroom_id: target.classroom_id,
          to_user_id: target.user_id,
          message: message.trim(),
          rating,
          category,
          is_anonymous: isStudent ? isAnonymous : false
        }
      })
      setSubmitSuccess(`Feedback sent to ${target.user_name}.`)
      setMessage('')
      setRating(null)
      setIsAnonymous(false)
      const sentPayload = await requestBackendJson('/feedback/sent', { headers: authHeaders })
      setSent(sentPayload.feedback || [])
    } catch (err) {
      setSubmitError(err.message || 'Could not send feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSent = async (feedbackId) => {
    try {
      await requestBackendJson(`/feedback/${feedbackId}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      setSent((current) => current.filter((item) => item.id !== feedbackId))
    } catch (err) {
      setError(err.message || 'Could not remove that feedback.')
    }
  }

  if (loading) {
    return (
      <div className="card p-6 text-sm text-zinc-500">Loading feedback...</div>
    )
  }

  if (targets.length === 0) {
    return (
      <div className="card p-6 text-sm leading-6 text-zinc-600">
        {isStudent
          ? 'Join a classroom first -- once you have an active classroom, its educator will show up here as a feedback recipient.'
          : 'Create a classroom and wait for students to join -- they will show up here as feedback recipients once enrolled.'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Send feedback</p>
            <h2 className="text-lg font-bold text-zinc-950">
              {isStudent ? 'Tell your educator what you think' : 'Send a student some feedback'}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">
              {isStudent ? 'Educator and classroom' : 'Student and classroom'}
            </label>
            <select
              value={selectedTarget}
              onChange={(event) => setSelectedTarget(event.target.value)}
              className="input w-full"
            >
              <option value="">Select who this is for...</option>
              {targets.map((target) => (
                <option key={targetKey(target)} value={targetKey(target)}>
                  {target.classroom_name} -- {target.user_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Rating (optional)</label>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Category</label>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="input">
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder={isStudent ? 'What is working, and what could be better?' : 'How is this student doing?'}
              className="input w-full"
            />
          </div>

          {isStudent && (
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Send this anonymously
            </label>
          )}

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {submitSuccess && <p className="text-sm text-emerald-700">{submitSuccess}</p>}

          <button type="submit" disabled={submitting} className="btn btn-primary inline-flex items-center gap-2">
            <Send className="h-4 w-4" />
            {submitting ? 'Sending...' : 'Send feedback'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="section-kicker text-[#18181b]">Feedback received</p>
              <h2 className="text-lg font-bold text-zinc-950">
                {received?.count || 0} total{received?.average_rating ? ` -- ${received.average_rating}/5 average` : ''}
              </h2>
            </div>
          </div>

          {received?.by_classroom?.length > 1 && (
            <select
              value={classroomFilter}
              onChange={(event) => handleClassroomFilterChange(event.target.value)}
              className="input"
            >
              <option value="">All classrooms</option>
              {received.by_classroom.map((bucket) => (
                <option key={bucket.classroom_id} value={bucket.classroom_id}>
                  {bucket.classroom_name} ({bucket.count})
                </option>
              ))}
            </select>
          )}
        </div>

        {received?.by_classroom?.length > 1 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {received.by_classroom.map((bucket) => (
              <div key={bucket.classroom_id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                <p className="font-semibold text-zinc-900">{bucket.classroom_name}</p>
                <p>{bucket.count} feedback{bucket.count === 1 ? '' : 's'}{bucket.average_rating ? ` -- ${bucket.average_rating}/5` : ''}</p>
              </div>
            ))}
          </div>
        )}

        {!received?.feedback?.length ? (
          <p className="text-sm text-zinc-500">No feedback received yet.</p>
        ) : (
          <div className="space-y-3">
            {received.feedback.map((item) => (
              <FeedbackCard key={item.id} item={item} viewerRole="received" />
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <p className="section-kicker text-[#18181b]">Feedback you have sent</p>
        {!sent.length ? (
          <p className="mt-3 text-sm text-zinc-500">You have not sent any feedback yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sent.map((item) => (
              <FeedbackCard key={item.id} item={item} viewerRole="sent" onDelete={handleDeleteSent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
