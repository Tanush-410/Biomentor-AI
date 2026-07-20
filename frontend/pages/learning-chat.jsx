import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Bot, Send, Sparkles } from 'lucide-react'

import AppShell from '../components/AppShell'
import AISpotlightBanner from '../components/AISpotlightBanner'
import QuickCheckCard from '../components/QuickCheckCard'
import ChatMarkdown from '../components/ChatMarkdown'
import { StudyCoachPanel } from '../components/StudyCoachPanel'
import { useAuth } from '../context/AuthContext'
import { normalizeListPayload, requestBackendJson } from '../lib/backendApi'

export default function LearningChatPage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const messagesEndRef = useRef(null)
  const [documents, setDocuments] = useState([])
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 'intro',
      role: 'assistant',
      content: 'Ask a question about your uploaded study material and I will answer from that content with source references.',
      sources: []
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [chatCoach, setChatCoach] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    fetchDocuments()
  }, [authLoading, token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchDocuments = async () => {
    try {
      const payload = await requestBackendJson('/documents/', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const nextDocuments = normalizeListPayload(payload)
      setDocuments(nextDocuments)
      if (nextDocuments[0]?.id) {
        setSelectedDocumentId(String(nextDocuments[0].id))
      }
      fetchStudyCoachSuggestions()
    } catch (err) {
      console.error('Failed to load documents for chat:', err)
    }
  }

  const fetchStudyCoachSuggestions = async () => {
    try {
      const payload = await requestBackendJson('/study-coach/chat-suggestions', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setChatCoach(payload)
    } catch (err) {
      console.error('Failed to load study coach chat suggestions:', err)
    }
  }

  const handleSendMessage = async (event) => {
    event.preventDefault()
    const question = inputValue.trim()
    if (!question) return

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question
    }
    setMessages((current) => [...current, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      const conversationHistory = messages
        .filter((message) => message.id !== 'intro')
        .slice(-6)
        .map((message) => ({
          role: message.role,
          content: message.content
        }))

      const payload = await requestBackendJson('/qa/answer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          question,
          document_ids: selectedDocumentId ? [selectedDocumentId] : undefined,
          include_sources: true,
          conversation_history: conversationHistory
        }
      })

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: payload.answer,
          sources: payload.sources || [],
          answerOrigin: payload.answer_origin || 'material',
          sourceBadge: payload.source_badge || null,
          confidenceLabel: payload.confidence_label || 'medium',
          confidenceReason: payload.confidence_reason || '',
          fallbackUsed: Boolean(payload.fallback_used),
          quickCheck: payload.quick_check || null
        }
      ])
    } catch (err) {
      console.error('Chat request failed:', err)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: err.message || 'I could not reach the server. Please try again.',
          sources: []
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell
      title="Learning Chat"
      description="Ask grounded questions about your uploaded study material and keep the source document one click away while you revise."
      contentClassName="max-w-5xl"
      actions={
        <>
          <Link href="/documents" className="btn btn-outline">Materials</Link>
          <Link href="/start-quiz" className="btn btn-primary">Practice with Quiz</Link>
        </>
      }
    >
        <AISpotlightBanner
          eyebrow="Chat AI Surface"
          title="AI Reasoning Mode"
          description="Ask from your own material first, then let VYDRA CORE widen the search when needed. This workspace is built to show where the answer came from, how confident the system is, and when a Quick Check should lock in the concept."
          highlights={['PDF-first grounding', 'Trusted web fallback', 'Adaptive quick checks']}
          primaryAction={{ label: 'Start Reasoning Session', href: '#chat-transcript' }}
          secondaryAction={{ label: 'Open Materials', href: '/documents#material-intelligence-studio' }}
          status="Use this when the concept is complex, the topic crosses documents, or you want the AI to show its evidence instead of giving a shallow answer."
        />

        <div className="card p-6 mb-6">
          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Use material as the answer source</label>
              <select
                value={selectedDocumentId}
                onChange={(event) => setSelectedDocumentId(event.target.value)}
                className="input"
              >
                <option value="">All uploaded materials</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </select>
            </div>

            <Link href={selectedDocumentId ? `/document/${selectedDocumentId}` : '/documents'} className="btn btn-outline inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Open Selected Material
            </Link>
          </div>
        </div>

        <div id="chat-coach">
          <StudyCoachPanel
            title="Coach next question"
            summary={chatCoach?.next_step || 'The coach can suggest what to ask next and when to use Quick Check after a complex answer.'}
            confidenceReason={chatCoach?.confidence_reason}
            actionLabel="Open Progress"
            actionHref="/progress"
            dailyGoal={chatCoach?.checkpoint_goal}
          >
            {(chatCoach?.follow_up_prompts || []).length > 0 ? (
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Suggested follow-up prompts</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {chatCoach.follow_up_prompts.map((prompt, index) => (
                    <p key={`${prompt}-${index}`}>• {prompt}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {chatCoach?.quick_check_guidance ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Quick Check timing</p>
                <p className="mt-2">{chatCoach.quick_check_guidance}</p>
              </div>
            ) : null}
          </StudyCoachPanel>
        </div>

        <div id="chat-transcript" className="card p-0 overflow-hidden">
          <div className="h-[60vh] overflow-y-auto px-6 py-6 bg-gradient-to-b from-[#fafafa] to-[#e4e4e7]">
            <div className="space-y-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl min-w-0 rounded-2xl px-5 py-4 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-[#c9ab3f] text-zinc-950'
                      : 'bg-[#fafafa] border border-zinc-200 text-slate-900'
                  }`}>
                    <div className="flex items-start gap-3">
                      {message.role === 'assistant' && (
                        <div className="mt-0.5 rounded-full bg-[#f4f4f5] p-2 text-[#18181b]">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <ChatMarkdown content={message.content} />
                        {message.role === 'assistant' && message.answerOrigin ? (
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">
                            {message.sourceBadge || (message.answerOrigin === 'material'
                              ? 'Answered from your material'
                              : message.answerOrigin === 'trusted_web'
                                ? 'Enhanced with trusted web sources'
                                : 'Enhanced with web sources')}
                          </p>
                        ) : null}
                        {message.role === 'assistant' && message.confidenceReason ? (
                          <p className={`mt-2 text-sm leading-6 ${message.confidenceLabel === 'low' ? 'text-zinc-800' : 'text-slate-600'}`}>
                            {message.confidenceReason}
                          </p>
                        ) : null}
                        {message.role === 'assistant' && message.sources?.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                            {message.sources.map((source, index) => (
                              <div key={`${message.id}-source-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="min-w-0 break-words font-semibold">{source.document_title}</p>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    {source.page_number ? <span>Page {source.page_number}</span> : null}
                                    {source.source_type && source.source_type !== 'material' ? (
                                      <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 font-semibold text-[#18181b]">
                                        {source.source_type === 'trusted_web' ? 'Trusted Web' : 'Web'}
                                      </span>
                                    ) : null}
                                    {source.document_id ? (
                                      <Link href={`/document/${source.document_id}?page=${source.page_number || 1}`} className="font-semibold text-[#18181b] hover:text-[#3f3f46]">
                                        Open source
                                      </Link>
                                    ) : source.url ? (
                                      <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-[#18181b] hover:text-[#3f3f46]">
                                        Open source
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-1 break-words text-slate-600">{source.excerpt}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {message.role === 'assistant' && message.quickCheck ? (
                          <QuickCheckCard quickCheck={message.quickCheck} token={token} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm">
                    AI is reading your material...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white px-6 py-5">
            <div className="flex gap-3">
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask about a concept from your uploaded material..."
                className="input flex-1"
                disabled={loading}
              />
              <button type="submit" disabled={loading} className="btn btn-primary inline-flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </form>
        </div>
    </AppShell>
  )
}
