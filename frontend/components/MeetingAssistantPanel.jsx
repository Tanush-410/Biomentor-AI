import React from 'react'

function SectionCard({ title, items, empty = 'No updates yet.' }) {
  return (
    <section className="rounded-[22px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18181b]">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {items?.length ? items.map((item) => <li key={`${title}-${item}`}>• {item}</li>) : <li>{empty}</li>}
      </ul>
    </section>
  )
}

function MoveCard({ move }) {
  return (
    <div className="rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18181b]">{move.label}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-700">{move.reason}</p>
    </div>
  )
}

export default function MeetingAssistantPanel({ snapshot, isLoading = false, transcriptSupported = false }) {
  const confidenceReason = snapshot?.confidenceReason || snapshot?.confidence_reason
  const teacherMoves = snapshot?.teacher_moves || []
  const followUpAssets = snapshot?.follow_up_assets || []

  return (
    <aside className="rounded-[28px] border border-[rgba(0,0,0,0.12)] bg-[#fafafa] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
      <p className="section-kicker text-[#18181b]">AI Meeting Assistant</p>
      <h3 className="mt-2 text-3xl font-bold text-slate-950">Mentor Copilot</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {transcriptSupported
          ? 'Transcript snippets and mentor meeting events are shaping this copilot in real time.'
          : 'Transcript capture is unavailable, so the copilot is leaning on explicit meeting flags and saved cues.'}
      </p>
      {confidenceReason ? (
        <p className="mt-3 text-xs font-medium leading-5 uppercase tracking-[0.16em] text-[#3f3f46]">
          {confidenceReason}
        </p>
      ) : null}
      {isLoading ? (
        <div className="mt-4 rounded-[20px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-3 text-sm text-slate-600">
          Refreshing mentor copilot guidance...
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <SectionCard title="Live Notes" items={snapshot?.live_notes?.items ?? []} />
        <SectionCard title="Concept Signals" items={snapshot?.concept_signals?.items ?? []} />
        <SectionCard title="Action Items" items={snapshot?.action_items?.items ?? []} />

        <section className="rounded-[22px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18181b]">Mentor Moves</h4>
          <div className="mt-3 space-y-3">
            {teacherMoves.length
              ? teacherMoves.map((move) => <MoveCard key={`${move.label}-${move.reason}`} move={move} />)
              : <p className="text-sm leading-6 text-slate-700">No teaching move suggestions yet.</p>}
          </div>
        </section>

        <SectionCard title="Student Risk Flags" items={snapshot?.student_risk_flags?.items ?? []} />
        <SectionCard title="Unanswered Doubts" items={snapshot?.unresolved_doubts?.items ?? []} />

        <section className="rounded-[22px] border border-[rgba(0,0,0,0.12)] bg-white/80 px-4 py-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18181b]">Follow-up Assets</h4>
          <div className="mt-3 space-y-3">
            {followUpAssets.length ? (
              followUpAssets.map((asset) => (
                <MoveCard key={`${asset.label}-${asset.reason}`} move={asset} />
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-700">No follow-up assets suggested yet.</p>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
