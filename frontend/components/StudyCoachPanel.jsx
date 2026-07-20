import React from 'react'
import Link from 'next/link'

function GoalCard({ title, goal }) {
  if (!goal?.label) return null
  return (
    <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">{title}</p>
      <h4 className="mt-3 text-lg font-bold text-slate-950">{goal.label}</h4>
      {goal.reason ? <p className="mt-2 text-sm leading-6 text-slate-600">{goal.reason}</p> : null}
    </div>
  )
}

function CoachStepList({ title, items }) {
  if (!items?.length) return null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="rounded-2xl border border-[#d4d4d8] bg-[#ffffff] p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c9ab3f] text-sm font-bold text-zinc-950">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-slate-950">{item.label}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                {item.target_url ? (
                  <Link href={item.target_url} className="mt-3 inline-flex text-sm font-semibold text-[#18181b] hover:text-[#3f3f46]">
                    Open step
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StudyCoachPanel({
  title = 'AI Study Coach',
  summary,
  confidenceReason,
  actionLabel,
  actionHref,
  studyMode,
  modeReason,
  dailyGoal,
  weeklyPlan,
  recoveryPath,
  children,
}) {
  return (
    <div className="card min-w-0 p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl min-w-0">
          <p className="section-kicker text-[#18181b]">AI Study Coach</p>
          <h3 className="mt-2 break-words text-2xl font-bold text-slate-950">{title}</h3>
          {summary ? <p className="mt-3 break-words text-sm leading-7 text-slate-600">{summary}</p> : null}
          {confidenceReason ? <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-[#18181b]">{confidenceReason}</p> : null}
        </div>
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="btn btn-primary shrink-0">
            {actionLabel}
          </Link>
        ) : null}
      </div>

      {(studyMode || dailyGoal?.label || weeklyPlan?.length || recoveryPath?.length) ? (
        <div className="mt-6 grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="min-w-0 rounded-2xl border border-[#d4d4d8] bg-[#f4f4f5] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Study mode</p>
              <h4 className="mt-3 break-words text-xl font-bold text-slate-950">{studyMode || 'Revision'}</h4>
              {modeReason ? <p className="mt-2 break-words text-sm leading-6 text-slate-600">{modeReason}</p> : null}
            </div>
            <GoalCard title="Daily goal" goal={dailyGoal} />
          </div>

          <div className="space-y-4">
            <CoachStepList title="Weekly plan" items={weeklyPlan} />
            <CoachStepList title="Recovery path" items={recoveryPath} />
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
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
