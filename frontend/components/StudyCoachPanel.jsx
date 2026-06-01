import React from 'react'
import Link from 'next/link'

export function StudyCoachPanel({ title = 'AI Study Coach', summary, confidenceReason, children, actionLabel, actionHref }) {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker text-[#8a5a36]">AI Study Coach</p>
          <h3 className="mt-2 text-xl font-bold text-slate-950">{title}</h3>
          {summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p> : null}
          {confidenceReason ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#8a5a36]">{confidenceReason}</p> : null}
        </div>
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="btn btn-outline shrink-0">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-5 space-y-4">
        {children}
      </div>
    </div>
  )
}

export function StudyCoachActionList({ actions }) {
  if (!actions?.length) return null

  return (
    <div className="space-y-3">
      {actions.map((action, index) => (
        <div key={`${action.label}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-lg font-bold text-slate-950">{action.label}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">{action.reason}</p>
            </div>
            {action.target_url ? (
              <Link href={action.target_url} className="btn btn-outline shrink-0">
                Open
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
