import React from 'react'
import Link from 'next/link'

export function EducatorCopilotPanel({ eyebrow = 'AI Educator Copilot', title, summary, children, actionLabel, actionHref }) {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker text-[#18181b]">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">{title}</h3>
          {summary && <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p>}
        </div>
        {actionLabel && actionHref && (
          <Link href={actionHref} className="btn btn-outline shrink-0">
            {actionLabel}
          </Link>
        )}
      </div>
      <div className="mt-5 space-y-4">
        {children}
      </div>
    </div>
  )
}

export function CopilotPriorityCard({ item }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
          {item.severity} priority
        </span>
        <span className="role-pill border-slate-200 bg-slate-50 text-slate-600">
          {item.category}
        </span>
      </div>
      <h4 className="mt-3 text-lg font-bold text-slate-950">{item.title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.rationale}</p>
      {item.confidence_reason ? (
        <p className="mt-2 text-xs font-medium leading-5 text-[#3f3f46]">{item.confidence_reason}</p>
      ) : null}
      {item.why_now ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          <span className="font-semibold text-[#18181b]">Why now:</span> {item.why_now}
        </p>
      ) : null}
      {item.recommended_window ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">
          Recommended window: {item.recommended_window}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-[#3f3f46]">{item.recommended_action}</p>
        {item.target_url && (
          <Link href={item.target_url} className="btn btn-outline shrink-0">
            Open
          </Link>
        )}
      </div>
    </div>
  )
}

export function CopilotDraftCard({ draft, onUseDraft }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
          {draft.source_type}
        </span>
        <span className="role-pill border-slate-200 bg-slate-50 text-slate-600">
          {draft.handling_mode.replace(/_/g, ' ')}
        </span>
      </div>
      <h4 className="mt-3 text-lg font-bold text-slate-950">{draft.subject}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{draft.summary}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">
        Tone: {draft.suggested_tone}
      </p>
      {draft.draft_reason ? (
        <p className="mt-2 text-sm leading-6 text-slate-700">
          <span className="font-semibold text-[#18181b]">Draft reason:</span> {draft.draft_reason}
        </p>
      ) : null}
      {draft.escalation_signal ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">
          Escalation signal: {draft.escalation_signal.replace(/_/g, ' ')}
        </p>
      ) : null}
      {draft.confidence_reason ? (
        <p className="mt-2 text-xs font-medium leading-5 text-[#3f3f46]">{draft.confidence_reason}</p>
      ) : null}
      <div className="mt-3 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm leading-7 text-slate-700">
        {draft.draft_reply}
      </div>
      <p className="mt-3 text-sm leading-6 text-[#3f3f46]">{draft.recommended_next_step}</p>
      {onUseDraft && (
        <button type="button" onClick={() => onUseDraft(draft)} className="btn btn-primary mt-4">
          Use Draft
        </button>
      )}
    </div>
  )
}

export function CopilotRecommendationCard({ item }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="text-lg font-bold text-slate-950">{item.topic}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.explanation || item.rationale}</p>
      {item.confidence_reason ? (
        <p className="mt-2 text-xs font-medium leading-5 text-[#3f3f46]">{item.confidence_reason}</p>
      ) : null}
      {item.teaching_move ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          <span className="font-semibold text-[#18181b]">Teaching move:</span> {item.teaching_move}
        </p>
      ) : null}
      {item.why_it_matters && (
        <p className="mt-3 text-sm leading-6 text-slate-700">{item.why_it_matters}</p>
      )}
      <p className="mt-3 text-sm font-medium text-[#3f3f46]">
        {item.recommended_action || item.next_step}
      </p>
      {item.review_sequence?.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Review sequence</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {item.review_sequence.map((step) => (
              <li key={`${item.topic}-${step}`}>• {step}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {item.suggested_format && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">
          Suggested format: {item.suggested_format}
        </p>
      )}
    </div>
  )
}
