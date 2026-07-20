import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { BookOpen, Brain, Eye, HardDriveDownload, Trash2, Upload } from 'lucide-react'

import AppShell from '../components/AppShell'
import AISpotlightBanner from '../components/AISpotlightBanner'
import MaterialIntelligencePanel from '../components/MaterialIntelligencePanel'
import { StudyCoachPanel } from '../components/StudyCoachPanel'
import { useAuth } from '../context/AuthContext'
import { fetchBackendWithFallback, normalizeListPayload, readErrorDetail } from '../lib/backendApi'
import { getOfflineDocument } from '../lib/offlineDocuments'

const fetchDocumentEndpoint = async (path, options = {}) => {
  return fetchBackendWithFallback(`/documents${path}`, options)
}

const fetchBackendEndpoint = async (path, options = {}) => {
  return fetchBackendWithFallback(path, options)
}

export default function DocumentsPage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [documents, setDocuments] = useState([])
  const [offlineStatus, setOfflineStatus] = useState({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [coachMaterials, setCoachMaterials] = useState(null)
  const [materialIntelligence, setMaterialIntelligence] = useState(null)
  const [uploadOptions, setUploadOptions] = useState({
    storageMode: 'full',
    selectedPages: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    fetchDocuments()
  }, [authLoading, token])

  const pdfCount = useMemo(
    () => documents.filter((doc) => doc.file_name?.toLowerCase().endsWith('.pdf')).length,
    [documents]
  )

  const fetchDocuments = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchDocumentEndpoint('/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const payload = await response.json()
        const docs = normalizeListPayload(payload, 'documents')
        setDocuments(docs)
        hydrateOfflineStatus(docs)
        loadStudyCoachMaterials()
        loadMaterialIntelligence(docs)
      } else {
        setError((await readErrorDetail(response)) || 'Failed to load your materials.')
      }
    } catch (err) {
      console.error('Document fetch error:', err)
      setError(err?.message || 'Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  const hydrateOfflineStatus = async (docs) => {
    const pairs = await Promise.all(
      docs.map(async (doc) => {
        const cached = await getOfflineDocument(String(doc.id)).catch(() => null)
        return [doc.id, Boolean(cached?.blob)]
      })
    )
    setOfflineStatus(Object.fromEntries(pairs))
  }

  const loadStudyCoachMaterials = async () => {
    try {
      const response = await fetchBackendEndpoint('/study-coach/materials', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const payload = await response.json()
        setCoachMaterials(payload)
      }
    } catch (err) {
      console.error('Study coach materials load error:', err)
    }
  }

  const loadMaterialIntelligence = async (docs = documents) => {
    const targetDoc = docs?.[0]
    if (!targetDoc) {
      setMaterialIntelligence(null)
      return
    }
    try {
      const response = await fetchDocumentEndpoint(`/${targetDoc.id}/material-intelligence`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const payload = await response.json()
        setMaterialIntelligence(payload)
      }
    } catch (err) {
      console.error('Material intelligence load error:', err)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', file.name.replace(/\.[^.]+$/, ''))
    formData.append('storage_mode', uploadOptions.storageMode)
    if (uploadOptions.selectedPages.trim()) {
      formData.append('selected_pages', uploadOptions.selectedPages.trim())
    }

    try {
      const response = await fetchDocumentEndpoint('/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      if (response.ok) {
        setSuccess(`"${file.name}" uploaded successfully.`)
        event.target.value = ''
        fetchDocuments()
      } else {
        setError((await readErrorDetail(response)) || 'Upload failed.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError(err?.message || 'Unable to upload file right now.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this material? This will remove the uploaded file from the app.')) return

    try {
      const response = await fetchDocumentEndpoint(`/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSuccess('Material deleted successfully.')
        setDocuments((current) => current.filter((doc) => doc.id !== docId))
        setOfflineStatus((current) => {
          const next = { ...current }
          delete next[docId]
          return next
        })
      } else {
        setError('Failed to delete this material.')
      }
    } catch (err) {
      console.error('Delete error:', err)
      setError('Unable to delete this material right now.')
    }
  }

  return (
    <AppShell
      title="Materials Library"
      description="Upload notes and PDFs, open them in the study viewer, save them offline, or turn them into quizzes from the same library."
      contentClassName="space-y-8"
      actions={
        <>
          <Link href="/dashboard" className="btn btn-outline">Dashboard</Link>
          <Link href="/start-quiz" className="btn btn-primary">Start Quiz</Link>
        </>
      }
    >
        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="card p-8 bg-[linear-gradient(145deg,#d9c25c_0%,#a88a26_56%,#f2e9c4_100%)] text-zinc-950">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#fafafa] mb-3">Upload once, learn anywhere</p>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Open your uploaded material, save it offline, and turn it into quizzes from the same screen.
            </h2>
            <p className="text-zinc-100/90 text-lg mb-6">
              This page now replaces the broken demo actions with the real study flow: upload, open, offline view, quiz, and delete.
            </p>

            <div className="flex flex-col gap-4">
              <label className="inline-flex w-fit cursor-pointer items-center gap-3 rounded-xl bg-[#fafafa] px-5 py-3 font-semibold text-[#3f3f46] shadow-lg">
                <Upload className="w-5 h-5" />
                {uploading ? 'Uploading...' : 'Upload Material'}
                <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} disabled={uploading} />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={uploadOptions.storageMode}
                  onChange={(e) => setUploadOptions((current) => ({ ...current, storageMode: e.target.value }))}
                  className="rounded-xl border border-white/18 bg-white/10 px-4 py-3 text-sm text-zinc-950 focus:border-[#fafafa] focus:outline-none"
                >
                  <option value="full" className="text-slate-900">Full upload with offline PDF viewer</option>
                  <option value="text_only" className="text-slate-900">Low-data text-only study mode</option>
                </select>
                <input
                  value={uploadOptions.selectedPages}
                  onChange={(e) => setUploadOptions((current) => ({ ...current, selectedPages: e.target.value }))}
                  placeholder="Optional pages: 1-5,8,10-12"
                  className="rounded-xl border border-white/18 bg-white/10 px-4 py-3 text-sm text-zinc-950 placeholder:text-[#fafafa]/70 focus:border-[#fafafa] focus:outline-none"
                />
              </div>
            </div>
            <p className="mt-4 text-sm text-zinc-100/80">
              Supported: PDF, TXT, Markdown. Choose <strong>text-only</strong> or specific page ranges when you want lighter processing and smaller stored material.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Library Snapshot</h3>
            <div className="grid grid-cols-2 gap-4">
              <MiniStat label="Materials" value={documents.length} />
              <MiniStat label="PDFs" value={pdfCount} />
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mt-5 text-sm text-slate-700">
              Use <strong>Open & Study</strong> to view the uploaded material, then click <strong>Save for Offline</strong> on the material page.
            </div>
          </div>
        </section>

        {(error || success) && (
          <div className="space-y-3">
            {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}
            {success && <div className="rounded-xl border border-[#d4d4d8] bg-[#e4e4e7] px-4 py-3 text-[#3f3f46]">{success}</div>}
          </div>
        )}

        <AISpotlightBanner
          eyebrow="Document AI Surface"
          title="Material Intelligence Studio"
          description="Turn every uploaded note or PDF into a visible AI study workspace: layered summaries, concept maps, misconception traps, viva prompts, and the exact path to revise it well."
          highlights={['Layered summaries', 'Concept map', 'Exam-focused study path']}
          primaryAction={{ label: 'Open Material Intelligence', href: '#material-intelligence-studio' }}
          secondaryAction={{ label: 'Review Coach Sequence', href: '#study-coach-materials' }}
          status="This is where VYDRA CORE stops being a file locker and starts acting like a study engine built around your own material."
        />

        <section className="card p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Your Uploaded Materials</h2>
              <p className="text-slate-600">Review files, open the offline viewer, generate quizzes, or remove old material.</p>
            </div>
            <Link href="/start-quiz" className="btn btn-primary inline-flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Start General Quiz
            </Link>
          </div>

          {loading ? (
            <p className="text-slate-500">Loading your library...</p>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
              No materials uploaded yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-2xl border border-slate-200 p-5 bg-white">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{doc.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {doc.file_name} · {doc.pages} pages · {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {doc.processing_status || 'completed'}
                        </span>
                        <span className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs font-semibold text-[#18181b]">
                          {doc.storage_mode === 'text_only' ? 'Text-only low-data mode' : 'Full study mode'}
                        </span>
                        {Array.isArray(doc.selected_pages) && doc.selected_pages.length > 0 && (
                          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
                            Pages {doc.selected_pages.slice(0, 5).join(', ')}{doc.selected_pages.length > 5 ? '…' : ''}
                          </span>
                        )}
                        {doc.file_name?.toLowerCase().endsWith('.pdf') && (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            offlineStatus[doc.id]
                              ? 'bg-[#d4d4d8] text-[#3f3f46]'
                              : 'bg-[#e4e4e7] text-[#18181b]'
                          }`}>
                            {offlineStatus[doc.id] ? 'Offline ready' : 'Offline not saved yet'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Link href={`/document/${doc.id}`} className="btn btn-outline inline-flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Open & Study
                      </Link>
                      <Link href={`/document/${doc.id}`} className="btn btn-outline inline-flex items-center gap-2">
                        <HardDriveDownload className="w-4 h-4" />
                        Offline Viewer
                      </Link>
                      <Link href={`/start-quiz?doc_id=${doc.id}`} className="btn btn-primary inline-flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Quiz from Material
                      </Link>
                      <button onClick={() => handleDelete(doc.id)} className="btn btn-outline inline-flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div id="study-coach-materials">
          <StudyCoachPanel
            title="Coach Recommended Review Path"
            summary={coachMaterials?.sequence_reason || 'The coach orders your uploaded materials so you know exactly what to revisit first.'}
            confidenceReason={coachMaterials?.confidence_reason}
            actionLabel="Open Learning Chat"
            actionHref="/learning-chat"
          >
            {(coachMaterials?.recommendations || []).length === 0 ? (
              <div className="surface-subtle p-4 text-sm text-slate-600">
                Upload a study file to let the coach recommend your next review target.
              </div>
            ) : (
              coachMaterials.recommendations.map((item) => (
                <div key={item.document_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                      <p className="mt-3 text-sm font-medium text-[#3f3f46]">{item.suggested_action}</p>
                    </div>
                    <Link href={`/document/${item.document_id}`} className="btn btn-outline shrink-0">
                      Open Material
                    </Link>
                  </div>
                </div>
              ))
            )}
          </StudyCoachPanel>
        </div>

        <section id="material-intelligence-studio" className="card p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-kicker text-[#18181b]">Material Intelligence Studio</p>
              <h2 className="text-3xl font-bold text-slate-950">Material Intelligence Preview, now upgraded into a full study workspace.</h2>
              <p className="mt-2 max-w-3xl text-slate-600">
                See what this material is really about before opening it: the strongest concepts, likely traps, viva prompts, and the best path to study it.
              </p>
            </div>
            {materialIntelligence ? (
              <Link href={`/document/${materialIntelligence.document_id}`} className="btn btn-primary shrink-0">
                Review With Material Intelligence
              </Link>
            ) : null}
          </div>

          <div className="mt-6">
            <MaterialIntelligencePanel
              intelligence={materialIntelligence}
              title={materialIntelligence ? `${materialIntelligence.document_title} at a glance` : 'AI Material Intelligence'}
              actionHref={materialIntelligence ? `/document/${materialIntelligence.document_id}` : null}
              actionLabel="Open Full Study View"
            />
          </div>
        </section>
    </AppShell>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
    </div>
  )
}
