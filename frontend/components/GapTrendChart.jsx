import React from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Mastery score at each recorded point, styled to the app's existing chart
// language (RecentScoresChart / ClassroomMasteryChart): #c9ab3f accent line,
// zinc gridlines, same tooltip card. One line per topic rather than several
// series on one chart -- topic count is unbounded and each topic's points
// land on different dates, so a shared time axis would misrepresent gaps
// between readings as a flat line. A single-series chart needs no legend;
// the card title above each one already names the topic.
function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{Math.round(item.mastery_score)}% score</p>
      <p className="text-slate-600">
        {item.recorded_at ? new Date(item.recorded_at).toLocaleDateString() : 'Unknown date'}
        {' · '}
        {item.source === 'quick_check' ? 'Quick check' : 'Quiz'}
      </p>
    </div>
  )
}

function TopicTrendMini({ topic, points }) {
  const data = points.map((point, index) => ({ attempt: index + 1, ...point }))
  const latest = data[data.length - 1]
  const first = data[0]
  const delta = data.length > 1 ? Math.round(latest.mastery_score - first.mastery_score) : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{topic}</p>
        {delta !== null && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              delta > 0 ? 'bg-emerald-50 text-emerald-700' : delta < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="0" />
            <XAxis dataKey="attempt" tick={false} axisLine={{ stroke: '#e4e4e7' }} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#e4e4e7' }} />
            <Line
              type="monotone"
              dataKey="mastery_score"
              stroke="#c9ab3f"
              strokeWidth={2}
              dot={{ r: 4, fill: '#c9ab3f', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#c9ab3f', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function GapTrendChart({ gapTrend = [], maxTopics = 6 }) {
  const byTopic = new Map()
  for (const point of gapTrend) {
    const key = point.topic || 'General'
    if (!byTopic.has(key)) byTopic.set(key, [])
    byTopic.get(key).push(point)
  }

  // Topics with the most tracked history first -- those are the ones with
  // an actual trend worth looking at, not a single lonely dot.
  const topics = [...byTopic.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxTopics)

  if (topics.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Your mastery trend per topic will chart here once you have a few tracked answers.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {topics.map(([topic, points]) => (
        <TopicTrendMini key={topic} topic={topic} points={points} />
      ))}
    </div>
  )
}
