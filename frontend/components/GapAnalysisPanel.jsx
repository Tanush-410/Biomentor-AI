import React from 'react'
import { AlertTriangle, Brain, CheckCircle2, History, ListChecks, Target } from 'lucide-react'

import GapTrendChart from './GapTrendChart'
import StatCard from './StatCard'

// Shared gap-analysis view: score/mastery summary, weak topics, per-topic
// trend charts, and study recommendations. Used both on the standalone Gap
// Analysis page and as a tab on the Quiz Generator page, so the two never
// drift apart.
export default function GapAnalysisPanel({ topicGaps, gapTrend, loading, onPracticeTopic, recommendations }) {
  const averageMastery = topicGaps.length
    ? Math.round(topicGaps.reduce((sum, topic) => sum + (topic.mastery_percentage || 0), 0) / topicGaps.length)
    : null
  const weakestTopic = topicGaps[0] || null
  const recommendedActions = [
    ...(recommendations?.immediate || []),
    ...(recommendations?.short_term || []),
  ]

  return (
    <div className="space-y-8">
      {!loading && topicGaps.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Topics tracked"
            value={topicGaps.length}
            accent="bg-[#f4f4f5] text-[#18181b]"
            icon={<ListChecks className="h-5 w-5" />}
          />
          <StatCard
            label="Average score"
            value={`${averageMastery}%`}
            accent="bg-[#e4e4e7] text-[#18181b]"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Weakest topic"
            value={weakestTopic ? weakestTopic.topic : '—'}
            accent="bg-[#fdf6df] text-[#8a6d1a]"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </section>
      )}

      {!loading && weakestTopic && (
        <section className="card flex flex-col gap-4 border-2 border-[#d9c25c]/60 bg-[#fdfaf0] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker text-[#18181b]">Fastest way to close a gap</p>
            <p className="mt-1 font-semibold text-slate-900">
              Practice &ldquo;{weakestTopic.topic}&rdquo; -- {weakestTopic.mastery_percentage}% mastery right now.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPracticeTopic?.(weakestTopic)}
            className="btn btn-primary shrink-0 inline-flex items-center justify-center gap-2"
          >
            <Brain className="w-4 h-4" />
            Generate quiz on this topic
          </button>
        </section>
      )}

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
        ) : (
          <GapTrendChart gapTrend={gapTrend} />
        )}
      </section>

      {!loading && recommendedActions.length > 0 && (
        <section className="card p-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-2xl bg-zinc-950 p-3 text-[#d9c25c]">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="section-kicker text-[#18181b]">Based on your gaps</p>
              <h2 className="text-xl font-bold text-slate-900">What to do next</h2>
            </div>
          </div>
          <ul className="space-y-3">
            {recommendedActions.map((action, index) => (
              <li key={index} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6d1a]" />
                {action}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
