import React from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert, TimerReset, UserX } from 'lucide-react'

function severityTone(severity) {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'border-zinc-300 bg-zinc-100 text-zinc-900'
    case 'high':
      return 'border-zinc-300 bg-zinc-100 text-zinc-800'
    case 'medium':
      return 'border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function postureTone(posture) {
  switch (posture) {
    case 'debarrment_candidate':
      return 'border-zinc-300 bg-zinc-100 text-zinc-900'
    case 'review_required':
      return 'border-zinc-300 bg-zinc-100 text-zinc-800'
    case 'monitor':
      return 'border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]'
    default:
      return 'border-zinc-300 bg-zinc-100 text-zinc-700'
  }
}

function summaryIcon(status) {
  if (status === 'terminated') return <UserX className="h-4 w-4" />
  if (status === 'submitted') return <CheckCircle2 className="h-4 w-4" />
  return <TimerReset className="h-4 w-4" />
}

export default function ProctorReviewPanel({ review, compact = false, title = 'AI Proctor Review' }) {
  if (!review) return null

  return (
    <div className="card min-w-0 p-6 lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="section-kicker text-[#18181b]">{title}</p>
          <h3 className="mt-2 break-words text-2xl font-bold text-slate-950">{review.quiz_title}</h3>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">{review.review_summary}</p>
          {review.confidence_reason ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#18181b]">{review.confidence_reason}</p> : null}
        </div>
        <span className={`role-pill ${severityTone(review.overall_severity)}`}>
          {review.overall_severity} severity
        </span>
      </div>

      <div className="mt-6 grid gap-5">
        <div className="min-w-0 rounded-3xl border border-[#d4d4d8] bg-[#fafafa] p-5">
          <p className="section-kicker text-[#18181b]">Case posture</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`role-pill ${postureTone(review.case_posture)}`}>{review.case_posture.replace(/_/g, ' ')}</span>
            <span className="role-pill border-slate-200 bg-white text-slate-700">Evidence strength: {review.evidence_strength}</span>
            <span className="role-pill border-slate-200 bg-white text-slate-700">Review priority: {review.review_priority.replace(/_/g, ' ')}</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Metric label="Incidents" value={review.incident_totals?.total_incidents || 0} />
            <Metric label="Warnings" value={review.incident_totals?.warning_events || 0} />
            <Metric label="Terminated" value={review.incident_totals?.terminated_attempts || 0} />
            <Metric label="Submitted" value={review.incident_totals?.submitted_attempts || 0} />
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5">
          <p className="section-kicker text-[#18181b]">Debar review</p>
          {review.debarrment_guidance ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">{review.debarrment_guidance.status}</p>
              <p className="mt-2 break-words text-sm leading-6 text-slate-600">{review.debarrment_guidance.rationale}</p>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              No debar review note is required for this case. Keep monitoring and use the follow-up actions below if the same signals repeat.
            </div>
          )}
        </div>
      </div>

      <div className={`mt-6 grid gap-6 ${compact ? '' : '2xl:grid-cols-[1.1fr_0.9fr]'}`}>
        <div className="space-y-4">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#18181b]" />
              <h4 className="text-lg font-bold text-slate-950">Student incident snapshots</h4>
            </div>
            <div className="mt-4 space-y-3">
              {(review.student_summaries || []).length === 0 ? (
                <p className="text-sm text-slate-600">No proctor incidents have been recorded for this view.</p>
              ) : (
                review.student_summaries.map((item) => (
                  <div key={item.student_id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {summaryIcon(item.attempt_status)}
                        {item.student_name}
                      </span>
                      <span className={`role-pill ${severityTone(item.attempt_status === 'terminated' ? 'critical' : item.warning_count >= 2 ? 'high' : 'medium')}`}>
                        {item.attempt_status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {item.warning_count} warning{item.warning_count === 1 ? '' : 's'} • {item.incident_count} recorded event{item.incident_count === 1 ? '' : 's'}
                    </p>
                    <p className="mt-2 text-sm font-medium text-[#3f3f46]">{item.top_incident}</p>
                    {item.termination_reason && (
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Termination reason: {item.termination_reason.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {!compact && (
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[#18181b]" />
                <h4 className="text-lg font-bold text-slate-950">Top signals</h4>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {(review.top_signals || []).length === 0 ? (
                  <p className="text-sm text-slate-600">No repeated signals yet.</p>
                ) : (
                  review.top_signals.map((signal) => (
                    <div key={signal.incident_type} className="rounded-full border border-[#d4d4d8] bg-[#f4f4f5] px-4 py-2 text-sm font-semibold text-[#18181b]">
                      {signal.incident_type} • {signal.count}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-lg font-bold text-slate-950">Follow-up actions</h4>
            <div className="mt-4 space-y-3">
              {(review.follow_up_actions || []).length ? (
                review.follow_up_actions.map((item, index) => (
                  <div key={`${item.phase}-${index}`} className="min-w-0 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">{item.phase}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.action}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  No immediate follow-up actions are required for this review.
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-lg font-bold text-slate-950">Educator recommendations</h4>
            <div className="mt-4 space-y-3">
              {(review.educator_recommendations || []).map((item, index) => (
                <div key={`${index}-${item}`} className="min-w-0 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-lg font-bold text-slate-950">Recent timeline</h4>
            <div className="mt-4 space-y-3">
              {(review.timeline || []).length === 0 ? (
                <p className="text-sm text-slate-600">No timeline events recorded.</p>
              ) : (
                review.timeline.slice(0, compact ? 4 : 6).map((item) => (
                  <div key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{item.student_name}</span>
                      <span className={`role-pill ${severityTone(item.severity)}`}>{item.severity}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{item.incident_type}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{item.action_taken}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  )
}
