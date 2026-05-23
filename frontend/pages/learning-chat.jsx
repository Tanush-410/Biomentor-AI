import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Bot, Send, Sparkles } from 'lucide-react'

import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const payload = await response.json()
        setDocuments(payload || [])
        if (payload?.[0]?.id) {
          setSelectedDocumentId(String(payload[0].id))
        }
      }
    } catch (err) {
      console.error('Failed to load documents for chat:', err)
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/qa/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question,
          document_ids: selectedDocumentId ? [selectedDocumentId] : undefined,
          include_sources: true,
          conversation_history: conversationHistory
        })
      })

      if (response.ok) {
        const payload = await response.json()
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: payload.answer,
            sources: payload.sources || []
          }
        ])
      } else {
        const payload = await response.json().catch(() => ({}))
        setMessages((current) => [
          ...current,
          {
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content: payload?.detail || 'I could not answer from your material right now.',
            sources: []
          }
        ])
      }
    } catch (err) {
      console.error('Chat request failed:', err)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I could not reach the server. Please try again.',
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

        <div className="card p-0 overflow-hidden">
          <div className="h-[60vh] overflow-y-auto px-6 py-6 bg-gradient-to-b from-[#fffaf5] to-[#f5ebdf]">
            <div className="space-y-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl min-w-0 rounded-2xl px-5 py-4 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-[#8a5a36] text-white'
                      : 'bg-[#fffaf5] border border-stone-200 text-slate-900'
                  }`}>
                    <div className="flex items-start gap-3">
                      {message.role === 'assistant' && (
                        <div className="mt-0.5 rounded-full bg-[#f2e4d4] p-2 text-[#8a5a36]">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words leading-7">{message.content}</p>
                        {message.role === 'assistant' && message.sources?.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                            {message.sources.map((source, index) => (
                              <div key={`${message.id}-source-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="min-w-0 break-words font-semibold">{source.document_title}</p>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    {source.page_number ? <span>Page {source.page_number}</span> : null}
                                    {source.document_id ? (
                                      <Link href={`/document/${source.document_id}?page=${source.page_number || 1}`} className="font-semibold text-[#8a5a36] hover:text-[#6d472d]">
                                        Open source
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-1 break-words text-slate-600">{source.excerpt}</p>
                              </div>
                            ))}
                          </div>
                        )}
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
