import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Award, Download, FileBadge2, ShieldCheck, Sparkles } from 'lucide-react'

import AppShell from '../../components/AppShell'
import { useAuth } from '../../context/AuthContext'
import { getCertificate } from '../../lib/classroomApi'

function formatDate(value) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function CertificateDetailPage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [certificate, setCertificate] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const certificateId = typeof router.query.certificateId === 'string' ? router.query.certificateId : ''

  useEffect(() => {
    if (authLoading || !router.isReady) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!certificateId) return
    void loadCertificate()
  }, [authLoading, token, router.isReady, certificateId])

  async function loadCertificate() {
    setLoading(true)
    setError('')
    try {
      const payload = await getCertificate(token, certificateId)
      setCertificate(payload.certificate)
      setMeta(payload.meta)
    } catch (err) {
      setError(err.message || 'Could not load certificate.')
    } finally {
      setLoading(false)
    }
  }

  const renderPayload = certificate?.render_payload || {}
  const completionMessage = renderPayload.completion_message || 'has completed the required certification path on VYDRA CORE.'
  const issuerName = meta?.issuer_name || renderPayload.issuer_name || 'VYDRA CORE'

  return (
    <AppShell
      title="Certificate"
      eyebrow="VYDRA CORE Award"
      description="A VYDRA CORE-branded completion artifact generated after the required classroom certification path is finished and approved."
      contentClassName="space-y-8"
      actions={
        <>
          <button type="button" onClick={() => window.print()} className="btn btn-outline">
            <Download className="h-4 w-4" />
            Print / Save PDF
          </button>
          <Link href="/progress" className="btn btn-primary">
            Back to Progress
          </Link>
        </>
      }
    >
      {error ? (
        <div className="rounded-[18px] border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="card p-6 text-slate-600">Loading certificate...</div>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
            <div className="card overflow-hidden">
              <div className="border-b border-zinc-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.9),rgba(228,228,231,0.8))] px-8 py-8">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#18181b]">VYDRA CORE Certificate</p>
                <h1 className="mt-5 text-4xl font-bold text-slate-950">{renderPayload.certificate_subtitle || 'Certificate of Completion'}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  Generated from the VYDRA CORE certification workflow after milestone completion and educator approval.
                </p>
              </div>

              <div className="p-8">
                <div className="rounded-[32px] border border-[#d4d4d8] bg-[linear-gradient(145deg,#ffffff,#f4f4f5)] p-8 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#18181b]">Awarded to</p>
                      <p className="mt-4 text-5xl font-bold text-slate-950">{certificate?.student_name}</p>
                    </div>
                    <div className="rounded-full border border-[#d4d4d8] bg-white/80 px-4 py-2 text-sm font-semibold text-[#3f3f46]">
                      {certificate?.certificate_number}
                    </div>
                  </div>

                  <div className="mt-8 rounded-[24px] border border-[#e6d4c4] bg-white/75 p-6">
                    <p className="text-2xl font-bold text-slate-950">{certificate?.course_title || meta?.certification_title}</p>
                    <p className="mt-4 text-base leading-8 text-slate-700">
                      <span className="font-semibold">{certificate?.student_name}</span> {completionMessage}
                    </p>
                  </div>

                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-[#d4d4d8] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Issuer</p>
                      <p className="mt-3 text-lg font-semibold text-slate-950">{issuerName}</p>
                    </div>
                    <div className="rounded-2xl border border-[#d4d4d8] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Issued</p>
                      <p className="mt-3 text-lg font-semibold text-slate-950">{formatDate(certificate?.issued_at)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#d4d4d8] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Classroom</p>
                      <p className="mt-3 text-lg font-semibold text-slate-950">{meta?.classroom_name || 'VYDRA CORE Classroom'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-6">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-[#18181b]" />
                  <div>
                    <p className="section-kicker text-[#18181b]">Certificate Meta</p>
                    <h3 className="text-2xl font-bold text-slate-950">What this proves</h3>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="surface-quiet p-4">
                    <p className="text-sm font-semibold text-slate-950">Certification</p>
                    <p className="mt-2 text-sm text-slate-600">{meta?.certification_title || certificate?.course_title}</p>
                  </div>
                  <div className="surface-quiet p-4">
                    <p className="text-sm font-semibold text-slate-950">Certificate number</p>
                    <p className="mt-2 text-sm text-slate-600">{certificate?.certificate_number}</p>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#18181b]" />
                  <div>
                    <p className="section-kicker text-[#18181b]">VYDRA CORE Validation</p>
                    <h3 className="text-2xl font-bold text-slate-950">Platform-backed completion artifact</h3>
                  </div>
                </div>
                <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
                  <p>This certificate was generated inside the VYDRA CORE classroom workflow after the required checkpoints were completed and reviewed.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">VYDRA CORE branded</span>
                    <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">Educator issued</span>
                    <span className="role-pill border-[#d4d4d8] bg-[#e4e4e7] text-[#3f3f46]">Classroom verified</span>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-[#18181b]" />
                  <div>
                    <p className="section-kicker text-[#18181b]">Use it next</p>
                    <h3 className="text-2xl font-bold text-slate-950">Share, save, or keep learning</h3>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  <button type="button" onClick={() => window.print()} className="btn btn-outline">
                    <FileBadge2 className="h-4 w-4" />
                    Export as PDF
                  </button>
                  <Link href="/progress" className="btn btn-primary">
                    Back to Progress
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  )
}
