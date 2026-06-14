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
        <circle cx="40" cy="40" r={radius} stroke="#ead8c6" strokeWidth={stroke} fill="none" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#8a5a36"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-slate-950">{normalized}</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a5a36]">Quality</div>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const tone =
    severity === 'high'
      ? 'border-red-200 bg-red-50 text-red-700'
      : severity === 'medium'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`role-pill ${tone}`}>{severity} issue</span>
}

export default function QuizQualityPanel({ review, loading, error, onReview }) {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-kicker text-[#8a5a36]">AI Quiz Quality Layer</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Check question quality before publish.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Review Bloom balance, distractor strength, explanations, and release readiness before students see the quiz.
          </p>
          {review?.confidence_reason ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#8a5a36]">{review.confidence_reason}</p> : null}
        </div>
        <button type="button" onClick={onReview} disabled={loading} className="btn btn-outline shrink-0">
          {loading ? 'Reviewing...' : 'Run AI Review'}
        </button>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {review ? (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <ScoreRing score={review.quality_score} />
              <div>
                <p className="section-kicker text-[#8a5a36]">Release readiness</p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {review.readiness === 'ready' ? 'Ready to publish' : 'Revise before release'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">{review.summary}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(review.bloom_distribution || []).map((item) => (
                <span key={`${item.level}-${item.label}`} className="role-pill border-[#ead8c6] bg-[#fbf2e8] text-[#8a5a36]">
                  {item.label}: {item.percentage}%
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <p className="section-kicker text-[#8a5a36]">Issues to fix</p>
              <div className="mt-3 space-y-3">
                {(review.issues || []).length ? (
                  review.issues.map((issue, index) => (
                    <div key={`${issue.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <SeverityBadge severity={issue.severity} />
                      <h5 className="mt-3 text-lg font-bold text-slate-950">{issue.title}</h5>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{issue.detail}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-subtle p-4 text-sm text-slate-600">No material issues were detected in this draft.</div>
                )}
              </div>
            </div>
            <div>
              <p className="section-kicker text-[#8a5a36]">Suggested improvements</p>
              <div className="mt-3 space-y-3">
                {(review.suggestions || []).length ? (
                  review.suggestions.map((suggestion, index) => (
                    <div key={`${suggestion.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="text-lg font-bold text-slate-950">{suggestion.title}</h5>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{suggestion.detail}</p>
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
          Run the review once your quiz draft is filled in. The assistant will flag weak distractors, answer-key patterns, missing explanations, and Bloom-distribution problems.
        </div>
      )}
    </div>
  )
}
