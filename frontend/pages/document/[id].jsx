import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, Brain, Download, FileText, RefreshCw, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'

import AppShell from '../../components/AppShell'
import AISpotlightBanner from '../../components/AISpotlightBanner'
import MaterialIntelligencePanel from '../../components/MaterialIntelligencePanel'
import { useAuth } from '../../context/AuthContext'
import { fetchBackendWithFallback, readErrorDetail } from '../../lib/backendApi'
import { deleteOfflineDocument, getOfflineDocument, saveOfflineDocument } from '../../lib/offlineDocuments'

const fetchDocumentEndpoint = async (path, options = {}) => {
  return fetchBackendWithFallback(`/documents${path}`, options)
}

export default function StudyDocumentPage() {
  const router = useRouter()
  const { id, page: pageQuery } = router.query
  const { token, user, loading: authLoading } = useAuth()
  const [document, setDocument] = useState(null)
  const [insights, setInsights] = useState(null)
  const [materialIntelligence, setMaterialIntelligence] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewerUrl, setViewerUrl] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [isOfflineReady, setIsOfflineReady] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [cacheActionLoading, setCacheActionLoading] = useState(false)

  const isPdf = useMemo(() => document?.file_name?.toLowerCase().endsWith('.pdf'), [document])
  const initialPage = useMemo(() => {
    const parsed = Number(pageQuery)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }, [pageQuery])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncOnlineStatus = () => setIsOffline(!window.navigator.onLine)
    syncOnlineStatus()
    window.addEventListener('online', syncOnlineStatus)
    window.addEventListener('offline', syncOnlineStatus)
    return () => {
      window.removeEventListener('online', syncOnlineStatus)
      window.removeEventListener('offline', syncOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    fetchDocument()
  }, [authLoading, router.isReady, token, id])

  useEffect(() => {
    return () => {
      if (viewerUrl) {
        window.URL.revokeObjectURL(viewerUrl)
      }
    }
  }, [viewerUrl])

  const replaceViewerUrl = (nextUrl) => {
    setViewerUrl((current) => {
      if (current) {
        window.URL.revokeObjectURL(current)
      }
      return appendPdfPage(nextUrl, initialPage)
    })
  }

  const fetchDocument = async () => {
    setLoading(true)
    setError('')

    const cached = await getOfflineDocument(String(id)).catch(() => null)
    if (cached?.metadata) {
      setDocument(cached.metadata)
      setIsOfflineReady(true)
    }

    try {
      const response = await fetchDocumentEndpoint(`/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const payload = await response.json()
        setDocument(payload)
        fetchInsights(payload.id)
        fetchMaterialIntelligence(payload.id)
        if (payload.file_name?.toLowerCase().endsWith('.pdf')) {
          await loadDocumentFile(payload, { preferCache: false })
        }
      } else if (response.status === 404) {
        if (!cached?.metadata) {
          setError('This study material could not be found.')
        }
      } else {
        if (!cached?.metadata) {
          setError((await readErrorDetail(response)) || 'Unable to load this document.')
        }
      }
    } catch (err) {
      console.error('Error loading document:', err)
      if (cached?.metadata) {
        setDocument(cached.metadata)
        fetchInsights(cached.metadata.id)
        fetchMaterialIntelligence(cached.metadata.id)
        await loadDocumentFile(cached.metadata, { preferCache: true })
      } else {
        setError(err?.message || 'Unable to connect to the server.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchInsights = async (documentId) => {
    try {
      const response = await fetchDocumentEndpoint(`/${documentId}/insights`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const payload = await response.json()
        setInsights(payload)
      }
    } catch (err) {
      console.error('Error loading document insights:', err)
    }
  }

  const fetchMaterialIntelligence = async (documentId) => {
    try {
      const response = await fetchDocumentEndpoint(`/${documentId}/material-intelligence`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const payload = await response.json()
        setMaterialIntelligence(payload)
      }
    } catch (err) {
      console.error('Error loading material intelligence:', err)
    }
  }

  const loadDocumentFile = async (metadata, { preferCache }) => {
    if (!metadata?.file_name?.toLowerCase().endsWith('.pdf')) return

    setFileLoading(true)
    setFileError('')

    const cached = await getOfflineDocument(String(metadata.id)).catch(() => null)
    if (cached?.blob) {
      setIsOfflineReady(true)
      if (preferCache || isOffline) {
        replaceViewerUrl(window.URL.createObjectURL(cached.blob))
        setFileLoading(false)
        return
      }
    }

    try {
      const response = await fetchDocumentEndpoint(`/${metadata.id}/file`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const detail = (await readErrorDetail(response)) || `Failed to load file (${response.status})`
        throw new Error(detail)
      }

      const blob = await response.blob()
      replaceViewerUrl(window.URL.createObjectURL(blob))
      await saveOfflineDocument({
        id: String(metadata.id),
        blob,
        metadata,
        mimeType: blob.type || 'application/pdf'
      }).catch((err) => {
        console.error('Error caching document:', err)
      })
      setIsOfflineReady(true)
    } catch (err) {
      console.error('Error loading PDF file:', err)
      if (cached?.blob) {
        replaceViewerUrl(window.URL.createObjectURL(cached.blob))
        setIsOfflineReady(true)
        setFileError('Showing your saved offline copy because the live PDF could not be loaded.')
      } else {
        setFileError(err?.message || 'Unable to load the PDF file yet.')
      }
    } finally {
      setFileLoading(false)
    }
  }

  const handleSaveOffline = async () => {
    if (!document || !isPdf) return
    setCacheActionLoading(true)
    await loadDocumentFile(document, { preferCache: false })
    setCacheActionLoading(false)
  }

  const handleRemoveOffline = async () => {
    if (!document) return
    setCacheActionLoading(true)
    try {
      await deleteOfflineDocument(String(document.id))
      setIsOfflineReady(false)
    } catch (err) {
      console.error('Error removing offline document:', err)
    } finally {
      setCacheActionLoading(false)
    }
  }

  const handleStartQuiz = () => {
    if (!document) return
    sessionStorage.removeItem('generatedQuestions')
    sessionStorage.setItem('quizConfig', JSON.stringify({
      numQuestions: 5,
      duration: 10,
      documentId: document.id,
      sessionId: null
    }))
    router.push('/quiz-session')
  }

  const openPage = (pageNumber) => {
    const nextPage = Number(pageNumber) > 0 ? Number(pageNumber) : 1
    router.replace(
      {
        pathname: router.pathname,
        query: { id, page: nextPage }
      },
      undefined,
      { shallow: true }
    )
    if (viewerUrl) {
      setViewerUrl((current) => appendPdfPage(current, nextPage))
    }
  }

  return (
    <AppShell
      title="Open & Study"
      description="Read the uploaded material, keep an offline copy ready, and jump straight into a quiz or Bloom's question analysis from the same study view."
      contentClassName="max-w-6xl"
      actions={
        <>
          <Link href="/documents" className="btn btn-outline">Materials</Link>
          <Link href="/start-quiz" className="btn btn-primary">Start Quiz</Link>
        </>
      }
    >
        {loading && (
          <div className="card p-10 text-center">
            <p className="text-slate-600">Loading study material...</p>
          </div>
        )}

        {!loading && error && (
          <div className="card p-10 text-center">
            <h2 className="text-2xl font-bold mb-2">Document unavailable</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <Link href="/dashboard" className="btn btn-primary">Return to Dashboard</Link>
          </div>
        )}

        {!loading && !error && document && (
          <div className="space-y-6">
            <AISpotlightBanner
              eyebrow="Document AI Surface"
              title="Deep Study Mode"
              description="This page is no longer just a viewer. It is your document-level AI study room: inspect the file, jump to key pages, open the intelligence workspace, and turn the same material into chat or quiz action."
              highlights={['Material intelligence', 'Key-page jumps', 'Quiz from this material']}
              primaryAction={{ label: 'Open Material Workspace', href: '#material-intelligence-workspace' }}
              secondaryAction={{ label: 'Jump to PDF Viewer', href: '#pdf-viewer' }}
              status="Use this mode when one document deserves focused revision. It is built to help you study deeper, not just read passively."
            />

            <div className="card p-8">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{document.title}</h2>
                  <p className="text-slate-600">{document.file_name}</p>
                </div>
                <div className="text-sm text-slate-600 lg:text-right">
                  <p>{document.pages} pages</p>
                  <p>{(document.file_size / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="capitalize">{document.processing_status || 'completed'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-6">
                <button onClick={handleStartQuiz} className="btn btn-primary flex items-center justify-center gap-2">
                  <Brain className="w-5 h-5" />
                  Quiz Me on This
                </button>
                {user?.role !== 'student' && (
                  <Link href="/check-difficulty" className="btn btn-outline flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5" />
                    Check a Question
                  </Link>
                )}
                {isPdf && (
                  <button
                    onClick={handleSaveOffline}
                    disabled={cacheActionLoading}
                    className="btn btn-outline flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    {cacheActionLoading ? 'Saving...' : isOfflineReady ? 'Refresh Offline Copy' : 'Save for Offline'}
                  </button>
                )}
                {isPdf && isOfflineReady && (
                  <button
                    onClick={handleRemoveOffline}
                    disabled={cacheActionLoading}
                    className="btn btn-outline flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Remove Offline Copy
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full ${
                  isOffline ? 'bg-[#e4e4e7] text-[#18181b]' : 'bg-[#f4f4f5] text-[#3f3f46]'
                }`}>
                  {isOffline ? <WifiOff className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                  {isOffline ? 'You are offline' : 'Online'}
                </span>
                {isPdf && (
                  <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full ${
                    isOfflineReady ? 'bg-[#d4d4d8] text-[#18181b]' : 'bg-[#f4f4f5] text-[#3f3f46]'
                  }`}>
                    <Download className="w-4 h-4" />
                    {isOfflineReady ? 'Available offline' : 'Not saved offline yet'}
                  </span>
                )}
              </div>
            </div>

            {isPdf && (
              <div id="pdf-viewer" className="card p-8">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-xl font-bold">PDF Viewer</h3>
                  {fileLoading && <p className="text-sm text-slate-500">Preparing PDF...</p>}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    Jumping to page {initialPage}
                  </span>
                  {initialPage > 1 && (
                    <button onClick={() => openPage(1)} className="rounded-full border border-[#d4d4d8] px-3 py-1 font-semibold text-[#27272a] transition hover:bg-[#f4f4f5]">
                      Return to page 1
                    </button>
                  )}
                </div>

                {fileError && (
                  <div className="mb-4 rounded-lg border border-[#d4d4d8] bg-[#f4f4f5] px-4 py-3 text-[#3f3f46] text-sm">
                    {fileError}
                  </div>
                )}

                {viewerUrl ? (
                  <iframe
                    src={viewerUrl}
                    title={document.title}
                    className="w-full h-[72vh] rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                    <div className="rounded-xl border border-dashed border-[#d4d4d8] bg-[#fafafa] p-10 text-center text-[#52525b]">
                      {isOffline
                        ? 'This PDF has not been saved offline yet. Reconnect once and click "Save for Offline".'
                        : 'Loading the PDF viewer...'}
                  </div>
                )}
              </div>
            )}

            <div className="card p-8">
              <h3 className="text-xl font-bold mb-4">Study Preview</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 whitespace-pre-wrap leading-7 text-slate-700">
                {document.content_preview?.trim() || 'A preview is not available for this file yet.'}
              </div>
              <p className="text-sm text-slate-500 mt-4">
                This preview uses the extracted document text currently stored by the backend.
              </p>
            </div>

            {insights && (
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="card p-8">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-xl font-bold">Concept Map</h3>
                    <span className="rounded-full bg-[#e4e4e7] px-3 py-1 text-sm font-semibold text-[#3f3f46]">
                      {insights.total_chunks} study chunks
                    </span>
                  </div>
                  {insights.concepts?.length ? (
                    <div className="flex flex-wrap gap-3">
                      {insights.concepts.map((concept) => (
                        <span
                          key={concept.label}
                          className="rounded-full border border-[#d4d4d8] bg-[#e4e4e7] px-4 py-2 text-sm font-semibold text-[#27272a]"
                        >
                          {concept.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600">Concept chips will appear after the document is processed into chunks.</p>
                  )}
                </div>

                <div className="card p-8">
                  <h3 className="text-xl font-bold mb-4">Key Pages</h3>
                  {insights.key_pages?.length ? (
                    <div className="grid gap-4">
                      {insights.key_pages.map((page) => (
                        <button
                          key={`${page.document_id}-${page.page_number}`}
                          onClick={() => openPage(page.page_number)}
                          className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-5 text-left transition hover:border-[#c9ab3f] hover:bg-[#f4f4f5]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wide text-[#27272a]">
                                Page {page.page_number}
                              </p>
                              <p className="text-sm text-slate-500">{page.chunk_count} supporting chunks</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              Open page
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">{page.preview}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600">Key study pages will appear after the document is processed.</p>
                  )}
                </div>
              </div>
            )}

            {materialIntelligence && (
              <section id="material-intelligence-workspace" className="card p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="section-kicker text-[#18181b]">AI Study Engine</p>
                    <h3 className="mt-2 text-3xl font-bold text-slate-950">Material Intelligence Workspace</h3>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                      Break this document into concepts, traps, viva prompts, and the best order to study it before you jump into questions.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/learning-chat" className="btn btn-outline">Ask Learning Chat</Link>
                    <button type="button" onClick={handleStartQuiz} className="btn btn-primary">
                      Generate Quiz From This Material
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <MaterialIntelligencePanel
                    intelligence={materialIntelligence}
                    title="Use the document as an exam-focused study engine"
                  />
                </div>
              </section>
            )}
          </div>
        )}
    </AppShell>
  )
}

function appendPdfPage(url, pageNumber) {
  if (!url) return ''
  const cleanUrl = String(url).split('#')[0]
  const safePage = Number(pageNumber) > 0 ? Number(pageNumber) : 1
  return `${cleanUrl}#page=${safePage}`
}
