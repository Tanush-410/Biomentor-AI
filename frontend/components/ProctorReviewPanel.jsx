import React from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert, TimerReset, UserX } from 'lucide-react'

function severityTone(severity) {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'high':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    case 'medium':
      return 'border-[#ead8c6] bg-[#fbf2e8] text-[#8a5a36]'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
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
    <div className="card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker text-[#8a5a36]">{title}</p>
          <h3 className="mt-2 text-xl font-bold text-slate-950">{review.quiz_title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{review.review_summary}</p>
          {review.confidence_reason ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#8a5a36]">{review.confidence_reason}</p> : null}
        </div>
        <span className={`role-pill ${severityTone(review.overall_severity)}`}>
          {review.overall_severity} severity
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Metric label="Incidents" value={review.incident_totals?.total_incidents || 0} />
        <Metric label="Warnings" value={review.incident_totals?.warning_events || 0} />
        <Metric label="Terminated" value={review.incident_totals?.terminated_attempts || 0} />
        <Metric label="Submitted" value={review.incident_totals?.submitted_attempts || 0} />
      </div>

      <div className={`mt-6 grid gap-6 ${compact ? 'xl:grid-cols-1' : 'xl:grid-cols-[1.1fr_0.9fr]'}`}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#8a5a36]" />
              <h4 className="text-lg font-bold text-slate-950">Student incident snapshots</h4>
            </div>
            <div className="mt-4 space-y-3">
              {(review.student_summaries || []).length === 0 ? (
                <p className="text-sm text-slate-600">No proctor incidents have been recorded for this view.</p>
              ) : (
                review.student_summaries.map((item) => (
                  <div key={item.student_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                    <p className="mt-2 text-sm font-medium text-[#6d472d]">{item.top_incident}</p>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[#8a5a36]" />
                <h4 className="text-lg font-bold text-slate-950">Top signals</h4>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {(review.top_signals || []).length === 0 ? (
                  <p className="text-sm text-slate-600">No repeated signals yet.</p>
                ) : (
                  review.top_signals.map((signal) => (
                    <div key={signal.incident_type} className="rounded-full border border-[#ead8c6] bg-[#fbf2e8] px-4 py-2 text-sm font-semibold text-[#8a5a36]">
                      {signal.incident_type} • {signal.count}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-lg font-bold text-slate-950">Educator recommendations</h4>
            <div className="mt-4 space-y-3">
              {(review.educator_recommendations || []).map((item, index) => (
                <div key={`${index}-${item}`} className="rounded-2xl border border-[#ead8c6] bg-[#fff8f1] p-4 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-lg font-bold text-slate-950">Recent timeline</h4>
            <div className="mt-4 space-y-3">
              {(review.timeline || []).length === 0 ? (
                <p className="text-sm text-slate-600">No timeline events recorded.</p>
              ) : (
                review.timeline.slice(0, compact ? 4 : 6).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a5a36]">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  )
}
