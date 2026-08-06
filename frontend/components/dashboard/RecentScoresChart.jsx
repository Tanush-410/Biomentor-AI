import React from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{item.fullTitle}</p>
      <p className="text-slate-600">{Math.round(item.score)}% &middot; {item.questionCount} questions</p>
    </div>
  )
}

export default function RecentScoresChart({ quizzes = [] }) {
  const data = [...quizzes]
    .reverse()
    .map((quiz, index) => ({
      name: quiz.title && quiz.title.length > 14 ? `${quiz.title.slice(0, 14)}…` : (quiz.title || `Quiz ${index + 1}`),
      fullTitle: quiz.title || `Quiz ${index + 1}`,
      score: Math.round(quiz.score || 0),
      questionCount: quiz.questionCount || 0,
    }))

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Recent quiz scores will chart here once you complete a quiz.
      </div>
    )
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<ScoreTooltip />} cursor={{ fill: '#f4f4f5' }} />
          <Bar dataKey="score" fill="#c9ab3f" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
