import React from 'react'

function ScoreRing({ score }) {
  const radius = 32
  const stroke = 7
  const circumference = 2 * Math.PI * radius
  const normalized = Math.max(0, Math.min(100, Number(score || 0)))
  const offset = circumference - (normalized / 100) * circumference

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={radius} stroke="#d4d4d8" strokeWidth={stroke} fill="none" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#c9ab3f"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-slate-950">{normalized}</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#18181b]">Quality</div>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const tone =
    severity === 'high'
      ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
      : severity === 'medium'
      ? 'border-zinc-300 bg-zinc-100 text-zinc-700'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`role-pill ${tone}`}>{severity} issue</span>
}

function RiskBadge({ risk }) {
  const tone =
    risk === 'high'
      ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
      : risk === 'medium'
      ? 'border-zinc-300 bg-zinc-100 text-zinc-700'
      : 'border-zinc-300 bg-zinc-100 text-zinc-700'
  return <span className={`role-pill ${tone}`}>{risk} release risk</span>
}

function HealthBadge({ status }) {
  const tone =
    status === 'revise'
      ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
      : status === 'watch'
      ? 'border-zinc-300 bg-zinc-100 text-zinc-700'
      : 'border-zinc-300 bg-zinc-100 text-zinc-700'
  return <span className={`role-pill ${tone}`}>{status}</span>
}

export default function QuizQualityPanel({ review, loading, error, onReview }) {
  return (
    <div className="card min-w-0 p-6 lg:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="section-kicker text-[#18181b]">AI Quiz Quality Layer</p>
          <h3 className="mt-2 break-words text-2xl font-bold text-slate-950">Run an assessment command review before you publish.</h3>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            Review Bloom balance, distractor strength, timing fairness, remediation readiness, and release risk before students see the quiz.
          </p>
          {review?.confidence_reason ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#18181b]">{review.confidence_reason}</p> : null}
        </div>
        <button type="button" onClick={onReview} disabled={loading} className="btn btn-outline shrink-0">
          {loading ? 'Reviewing...' : 'Run AI Review'}
        </button>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-900">{error}</div> : null}

      {review ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-5">
            <div className="min-w-0 rounded-3xl border border-[#d4d4d8] bg-[#fafafa] p-5">
              <p className="section-kicker text-[#18181b]">Assessment command</p>
              <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
                <ScoreRing score={review.quality_score} />
                <div className="min-w-0 flex-1">
                  <p className="section-kicker text-[#18181b]">Release readiness</p>
                  <h4 className="text-2xl font-bold text-slate-950">
                    {review.readiness === 'ready' ? 'Ready to publish' : 'Revise before release'}
                  </h4>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#18181b]">
                    {review.assessment_focus}
                  </p>
                  <p className="mt-3 break-words text-sm leading-6 text-slate-600">{review.summary}</p>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="section-kicker text-[#18181b]">Release risk</p>
                  <h4 className="mt-2 break-words text-xl font-bold text-slate-950">Publishing risk check</h4>
                </div>
                <RiskBadge risk={review.release_risk} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(review.bloom_distribution || []).map((item) => (
                  <span key={`${item.level}-${item.label}`} className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
                    {item.label}: {item.percentage}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5">
              <p className="section-kicker text-[#18181b]">Fix first</p>
              <div className="mt-4 space-y-3">
                {(review.fix_first || []).length ? (
                  review.fix_first.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="min-w-0 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                      <h5 className="break-words text-lg font-bold text-slate-950">{item.title}</h5>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-700">{item.detail}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">{item.impact}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-subtle p-4 text-sm text-slate-600">Run the review to see the highest-priority fixes before release.</div>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5">
              <p className="section-kicker text-[#18181b]">Remediation plan</p>
              <div className="mt-4 space-y-3">
                {(review.remediation_plan || []).length ? (
                  review.remediation_plan.map((step, index) => (
                    <div key={`${step.phase}-${index}`} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">{step.phase}</p>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-700">{step.action}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-subtle p-4 text-sm text-slate-600">The assistant will outline what to do before release and after grading.</div>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5">
            <p className="section-kicker text-[#18181b]">Question health</p>
            <h4 className="mt-2 text-xl font-bold text-slate-950">Which questions are strong, risky, or still too weak.</h4>
            <div className="mt-4 grid gap-3">
              {(review.question_health || []).length ? (
                review.question_health.map((item) => (
                  <div key={`${item.question_number}-${item.title}`} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">Q{item.question_number}</span>
                      <HealthBadge status={item.status} />
                    </div>
                    <h5 className="mt-3 break-words text-lg font-bold text-slate-950">{item.title}</h5>
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                ))
              ) : (
                <div className="surface-subtle p-4 text-sm text-slate-600">Question health cards appear for manual quizzes after you run the review.</div>
              )}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="min-w-0">
              <p className="section-kicker text-[#18181b]">Issues to fix</p>
              <div className="mt-3 space-y-3">
                {(review.issues || []).length ? (
                  review.issues.map((issue, index) => (
                    <div key={`${issue.title}-${index}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                      <SeverityBadge severity={issue.severity} />
                      <h5 className="mt-3 break-words text-lg font-bold text-slate-950">{issue.title}</h5>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{issue.detail}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-subtle p-4 text-sm text-slate-600">No material issues were detected in this draft.</div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <p className="section-kicker text-[#18181b]">Suggested improvements</p>
              <div className="mt-3 space-y-3">
                {(review.suggestions || []).length ? (
                  review.suggestions.map((suggestion, index) => (
                    <div key={`${suggestion.title}-${index}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="break-words text-lg font-bold text-slate-950">{suggestion.title}</h5>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{suggestion.detail}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-subtle p-4 text-sm text-slate-600">Run the AI review to generate improvement suggestions.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 surface-subtle p-5 text-sm leading-6 text-slate-600">
          Run the review once your quiz draft is filled in. The assistant will tell you what this quiz is really measuring, what to fix first, which questions are too weak, and how to use the results after students finish.
        </div>
      )}
    </div>
  )
}
