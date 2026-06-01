import React from 'react'
import Link from 'next/link'

function FocusTopics({ topics }) {
  if (!topics?.length) return null

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => (
        <span key={topic} className="role-pill border-[#ead8c6] bg-[#fbf2e8] text-[#8a5a36]">
          {topic}
        </span>
      ))}
    </div>
  )
}

function ActionCard({ action }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-950">{action.label}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">{action.reason}</p>
        </div>
        {action.target_url ? (
          <Link href={action.target_url} className="btn btn-outline shrink-0">
            Open
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function TeacherSignalCard({ signal }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="role-pill border-[#ead8c6] bg-[#fbf2e8] text-[#8a5a36]">
          {signal.severity} signal
        </span>
      </div>
      <h4 className="mt-3 text-lg font-bold text-slate-950">{signal.title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{signal.detail}</p>
      {signal.target_url ? (
        <div className="mt-4">
          <Link href={signal.target_url} className="btn btn-outline">
            Review
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export default function ClassroomIntelligencePanel({ intelligence, role = 'student', variant = 'stream' }) {
  const teacherView = intelligence?.teacher_view
  const studentView = intelligence?.student_view
  const isTeacher = role === 'educator' || role === 'admin'
  const eyebrow = isTeacher ? 'AI Classroom Intelligence' : 'Class Focus Coach'
  const title = isTeacher ? 'What this classroom needs next.' : 'What to focus on in this classroom.'
  const summary = isTeacher ? teacherView?.overview_summary : studentView?.overview_summary
  const confidenceReason = isTeacher ? teacherView?.confidence_reason : studentView?.confidence_reason

  if (!summary) return null

  return (
    <div className="card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="section-kicker text-[#8a5a36]">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">{summary}</p>
          {confidenceReason ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#8a5a36]">{confidenceReason}</p> : null}
        </div>
        <FocusTopics topics={(isTeacher ? teacherView?.focus_topics : studentView?.focus_topics) || []} />
      </div>

      {isTeacher ? (
        <div className={`mt-6 grid gap-6 ${variant === 'classwork' ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : 'xl:grid-cols-[minmax(0,1fr)_340px]'}`}>
          <div className="space-y-4">
            <div>
              <p className="section-kicker text-[#8a5a36]">Recommended next steps</p>
              <div className="mt-3 space-y-3">
                {(teacherView?.recommended_actions || []).map((action, index) => (
                  <ActionCard key={`${action.label}-${index}`} action={action} />
                ))}
              </div>
            </div>
            {teacherView?.meeting_follow_up?.length ? (
              <div className="rounded-2xl border border-[#ead8c6] bg-[#fff8f1] p-5">
                <p className="section-kicker text-[#8a5a36]">Meeting follow-up</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {teacherView.meeting_follow_up.map((item, index) => (
                    <li key={`${item}-${index}`}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <p className="section-kicker text-[#8a5a36]">Attention signals</p>
            {(teacherView?.attention_signals || []).length ? (
              teacherView.attention_signals.map((signal, index) => (
                <TeacherSignalCard key={`${signal.title}-${index}`} signal={signal} />
              ))
            ) : (
              <div className="surface-subtle p-4 text-sm text-slate-600">No urgent classroom signals right now.</div>
            )}
          </div>
        </div>
      ) : (
        <div className={`mt-6 grid gap-6 ${variant === 'classwork' ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : 'xl:grid-cols-[minmax(0,1fr)_300px]'}`}>
          <div className="space-y-4">
            <div>
              <p className="section-kicker text-[#8a5a36]">Next best moves</p>
              <div className="mt-3 space-y-3">
                {(studentView?.next_steps || []).map((action, index) => (
                  <ActionCard key={`${action.label}-${index}`} action={action} />
                ))}
              </div>
            </div>
            {studentView?.key_takeaways?.length ? (
              <div className="rounded-2xl border border-[#ead8c6] bg-[#fff8f1] p-5">
                <p className="section-kicker text-[#8a5a36]">Recent class takeaways</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {studentView.key_takeaways.map((item, index) => (
                    <li key={`${item}-${index}`}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="space-y-4">
            <div className="surface-subtle p-5">
              <p className="section-kicker text-[#8a5a36]">Personal focus</p>
              <h4 className="mt-2 text-xl font-bold text-slate-950">
                {studentView?.personalized_focus || 'Stay aligned with the class focus'}
              </h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use this focus before your next classroom quiz or chat follow-up.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
