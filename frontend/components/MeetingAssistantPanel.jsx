export default function MeetingAssistantPanel({ snapshot, isLoading = false, transcriptSupported = false }) {
  const sections = [
    ['Live Notes', snapshot?.live_notes?.items ?? []],
    ['Action Items', snapshot?.action_items?.items ?? []],
    ['Unanswered Doubts', snapshot?.unresolved_doubts?.items ?? []],
    ['Suggested Follow-up', snapshot?.follow_up_suggestions?.items ?? []]
  ]

  return (
    <aside className="rounded-[28px] border border-[rgba(138,90,54,0.12)] bg-[#fff8f0] p-5 shadow-[0_20px_50px_rgba(69,39,21,0.06)]">
      <p className="section-kicker text-[#8a5a36]">AI Meeting Assistant</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">Teacher-only live guidance.</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {transcriptSupported
          ? 'Transcript snippets and meeting events are shaping these notes in real time.'
          : 'Browser transcript capture is unavailable, so the assistant relies on meeting events and saved cues.'}
      </p>
      {snapshot?.confidenceReason || snapshot?.confidence_reason ? (
        <p className="mt-3 text-xs font-medium leading-5 text-[#6d472d]">
          {snapshot?.confidenceReason || snapshot?.confidence_reason}
        </p>
      ) : null}
      {isLoading ? (
        <div className="mt-4 rounded-[20px] border border-[rgba(138,90,54,0.12)] bg-white/80 px-4 py-3 text-sm text-slate-600">
          Refreshing meeting notes...
        </div>
      ) : null}
      <div className="mt-5 space-y-4">
        {sections.map(([title, items]) => (
          <section key={title} className="rounded-[20px] border border-[rgba(138,90,54,0.12)] bg-white/80 px-4 py-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a5a36]">{title}</h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {items.length
                ? items.map((item) => <li key={`${title}-${item}`}>{item}</li>)
                : <li>No updates yet.</li>}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  )
}
