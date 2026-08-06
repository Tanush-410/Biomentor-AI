import React from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function MasteryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{item.fullName}</p>
      <p className="text-slate-600">{Math.round(item.mastery)}% avg mastery &middot; {item.studentCount} students</p>
    </div>
  )
}

export default function ClassroomMasteryChart({ classrooms = [] }) {
  const data = classrooms.slice(0, 8).map((room, index) => ({
    name: room.name && room.name.length > 12 ? `${room.name.slice(0, 12)}…` : (room.name || `Class ${index + 1}`),
    fullName: room.name || `Class ${index + 1}`,
    mastery: Math.round(room.average_mastery || 0),
    studentCount: room.student_count || 0,
  }))

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Classroom mastery will chart here once a classroom has quiz activity.
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
          <Tooltip content={<MasteryTooltip />} cursor={{ fill: '#f4f4f5' }} />
          <Bar dataKey="mastery" fill="#c9ab3f" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
