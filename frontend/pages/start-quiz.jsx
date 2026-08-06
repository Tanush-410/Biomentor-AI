import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Brain, Clock, FileText, TrendingUp } from 'lucide-react'

import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import { normalizeListPayload, requestBackendJson } from '../lib/backendApi'

const DEFAULT_BLOOM_LEVEL = 3

export default function StartQuizPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const [documents, setDocuments] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [numQuestions, setNumQuestions] = useState(5)
  const [duration, setDuration] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [weakTopics, setWeakTopics] = useState([])
  const quizFormRef = useRef(null)

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    fetchDocuments()
    fetchWeakTopics()
  }, [authLoading, token])

  const fetchWeakTopics = async () => {
    try {
      const payload = await requestBackendJson('/gaps/topics', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setWeakTopics(payload?.topic_gaps || [])
    } catch (err) {
      console.error('Error fetching weak topics:', err)
    }
  }

  const practiceTopic = (topic) => {
    if (topic.document_id) {
      setSelectedDoc(String(topic.document_id))
    }
    quizFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (!router.isReady) return
    const docId = router.query.doc_id
    if (docId) {
      setSelectedDoc(String(docId))
    }
  }, [router.isReady, router.query.doc_id])

  const selectedDocument = useMemo(
    () => documents.find((doc) => String(doc.id) === String(selectedDoc)) || null,
    [documents, selectedDoc]
  )

  const fetchDocuments = async () => {
    try {
      const payload = await requestBackendJson('/documents/', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDocuments(normalizeListPayload(payload))
    } catch (err) {
      console.error('Error fetching documents:', err)
    }
  }

  const handleStartQuiz = async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await requestBackendJson('/quiz/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          num_questions: numQuestions,
          bloom_level: DEFAULT_BLOOM_LEVEL,
          document_ids: selectedDoc ? [selectedDoc] : [],
          duration_minutes: duration
        }
      })

      const questions = Array.isArray(payload?.questions) ? payload.questions : []

      if (questions.length === 0) {
        setError('We could not generate a usable quiz from that material yet. Try another file.')
        return
      }

      sessionStorage.setItem('quizConfig', JSON.stringify({
        numQuestions,
        duration,
        documentId: selectedDoc,
        sessionId: payload.session_id || null,
        bloomLevel: DEFAULT_BLOOM_LEVEL
      }))
      sessionStorage.setItem('generatedQuestions', JSON.stringify(questions))
      router.push('/quiz-session')
    } catch (err) {
      console.error('Start quiz error:', err)
      setError(err.message || 'Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell
      title="Start a Quiz"
      description="Choose one uploaded material or mix across your library, then generate AI quiz questions from it."
      contentClassName="max-w-5xl space-y-8"
      actions={
        <>
          <Link href="/documents" className="btn btn-outline">Back to Materials</Link>
          {user?.role !== 'student' && (
            <Link href="/check-difficulty" className="btn btn-outline">SOLO Tools</Link>
          )}
        </>
      }
    >
        {weakTopics.length > 0 && (
          <section className="card p-8 border-2 border-[#d9c25c]/60 bg-[#fdfaf0]">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="section-kicker text-[#18181b]">From your gap analysis</p>
                <h2 className="text-xl font-bold text-slate-900">Improve where you&apos;re weak</h2>
              </div>
            </div>
            <p className="text-slate-600 mb-5">
              Based on your past quizzes and quick checks, these are your weakest topics right now. Pick one to
              practice it directly.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {weakTopics.map((topic) => (
                <button
                  key={topic.topic}
                  type="button"
                  onClick={() => practiceTopic(topic)}
                  className="rounded-xl border border-[#d9c25c]/50 bg-white p-4 text-left transition hover:border-[#c9ab3f] hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{topic.topic}</p>
                    <span className="shrink-0 rounded-full bg-[#fdf6df] px-2.5 py-1 text-xs font-semibold text-[#8a6d1a]">
                      {topic.gap_percentage}% gap
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {topic.mastery_percentage}% mastery · {topic.answered_count} answers tracked
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#8a6d1a]">Practice this topic &rarr;</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <section ref={quizFormRef} className="card p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Generate AI quiz questions from your material</h2>
          <p className="text-slate-600 mb-6">
            Choose one uploaded document or leave it open for a mixed-material quiz.
          </p>

          {error && (
            <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 mb-6">
              {error}
            </div>
          )}

          <div className="space-y-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Choose study material</label>
              {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  No material uploaded yet. Go to Materials first and upload a PDF or notes file.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoc(String(doc.id))}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        String(selectedDoc) === String(doc.id)
                          ? 'border-zinc-950 bg-zinc-100'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{doc.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{doc.pages} pages · {doc.file_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Number of questions</label>
                <div className="rounded-xl border border-slate-200 p-5">
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={numQuestions}
                    onChange={(event) => setNumQuestions(Number(event.target.value))}
                    className="w-full"
                  />
                  <p className="text-lg font-semibold text-zinc-900 mt-3">{numQuestions} questions</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Time limit</label>
                <div className="rounded-xl border border-slate-200 p-5">
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                    className="w-full"
                  />
                  <p className="text-lg font-semibold text-zinc-900 mt-3">{duration} minutes</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">Quiz summary</p>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedDocument ? `Using "${selectedDocument.title}"` : 'Using all available materials'}
                  {' · '}
                  {numQuestions} questions
                  {' · '}
                  {duration} minutes
                </p>
              </div>

              <button onClick={handleStartQuiz} disabled={loading || documents.length === 0} className="btn btn-primary inline-flex items-center gap-2">
                <Brain className="w-4 h-4" />
                {loading ? 'Generating Quiz...' : 'Generate Quiz'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <FeatureCard
            icon={<FileText className="w-5 h-5" />}
            title="Material-grounded"
            description="Questions are generated from the uploaded file instead of placeholder content."
          />
          <FeatureCard
            icon={<Clock className="w-5 h-5" />}
            title="Timed practice"
            description="Use timed sessions to simulate exam pressure and track performance."
          />
        </section>
    </AppShell>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="card p-6">
      <div className="inline-flex items-center justify-center rounded-full bg-zinc-100 p-3 text-zinc-900">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mt-4">{title}</h3>
      <p className="text-slate-600 mt-2">{description}</p>
    </div>
  )
}
