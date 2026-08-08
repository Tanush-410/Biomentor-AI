import React from 'react'
import { AlertTriangle, Brain, History, Target } from 'lucide-react'

// Shared gap-analysis view: weak topics with mastery/score and gap-over-time
// history. Used both on the standalone Gap Analysis page and as a tab on the
// Quiz Generator page, so the two never drift apart.
export default function GapAnalysisPanel({ topicGaps, gapTrend, loading, onPracticeTopic }) {
  return (
    <div className="space-y-8">
      <section className="card p-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Current weak topics</p>
            <h2 className="text-xl font-bold text-slate-900">What to work on</h2>
          </div>
        </div>
        <p className="text-slate-600 mb-6">
          Ranked worst-first, based on your real quiz and quick-check answers, mapped back to the material each
          question came from.
        </p>

        {loading ? (
          <p className="text-slate-500">Loading your gap analysis...</p>
        ) : topicGaps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
            No gap data yet. Complete a quiz or answer a Learning Chat quick check, and your weak topics will
            show up here automatically.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {topicGaps.map((topic) => (
              <div key={topic.topic} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{topic.topic}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {topic.answered_count} answer{topic.answered_count === 1 ? '' : 's'} tracked
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#fdf6df] px-2.5 py-1 text-xs font-semibold text-[#8a6d1a]">
                    <AlertTriangle className="h-3 w-3" />
                    {topic.gap_percentage}% gap
                  </span>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#c9ab3f]"
                    style={{ width: `${Math.max(4, topic.mastery_percentage)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">{topic.mastery_percentage}% mastery (score)</p>

                <button
                  type="button"
                  onClick={() => onPracticeTopic?.(topic)}
                  className="btn btn-primary mt-4 w-full inline-flex items-center justify-center gap-2"
                >
                  <Brain className="w-4 h-4" />
                  Generate quiz on this topic
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker text-[#18181b]">Over time</p>
            <h2 className="text-xl font-bold text-slate-900">Are you improving?</h2>
          </div>
        </div>
        <p className="text-slate-600 mb-6">
          Every completed quiz and quick check adds a new point here, so you can see whether a topic is actually
          getting better or staying stuck.
        </p>

        {loading ? (
          <p className="text-slate-500">Loading history...</p>
        ) : gapTrend.length === 0 ? (
          <p className="text-slate-600">No history recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {gapTrend.slice(-15).reverse().map((point, index) => (
              <div
                key={`${point.topic}-${point.recorded_at || index}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{point.topic}</p>
                  <p className="text-xs text-slate-500">
                    {point.recorded_at ? new Date(point.recorded_at).toLocaleString() : 'Unknown time'}
                    {' · '}
                    {point.source === 'quick_check' ? 'Quick check' : 'Quiz'}
                  </p>
                </div>
                <span className="font-semibold text-slate-700">{Math.round(point.mastery_score)}% score</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
