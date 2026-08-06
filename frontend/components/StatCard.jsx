import React from 'react'

export default function StatCard({ label, value, accent = 'bg-[#f4f4f5] text-[#18181b]', icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${accent}`}>
        {icon}
        {label}
      </div>
      <p className="mt-6 text-4xl font-bold text-slate-950">{value}</p>
    </div>
  )
}
