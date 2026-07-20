import React from 'react'
import Link from 'next/link'

function FocusTopics({ topics }) {
  if (!topics?.length) return null

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => (
        <span key={topic} className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
          {topic}
        </span>
      ))}
    </div>
  )
}

function ActionCard({ action, ctaLabel = 'Open' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
      <h4 className="break-words text-base font-bold text-slate-950">{action.label}</h4>
      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{action.reason}</p>
      {action.target_url ? (
        <div className="mt-4">
          <Link href={action.target_url} className="btn btn-outline w-full sm:w-auto">
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function FocusGroupCard({ group }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="min-w-0 break-words text-base font-bold text-slate-950">{group.label}</h4>
        <span className="rounded-full bg-[#e4e4e7] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">
          {group.learner_count} learners
        </span>
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{group.reason}</p>
    </div>
  )
}

function BriefCard({ brief }) {
  if (!brief) return null

  return (
    <div className="min-w-0 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-5">
      <p className="section-kicker text-[#18181b]">Educator brief</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Now</p>
          <p className="mt-2 break-words text-sm leading-6 text-slate-700">{brief.now}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Next</p>
          <p className="mt-2 break-words text-sm leading-6 text-slate-700">{brief.next}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Later</p>
          <p className="mt-2 break-words text-sm leading-6 text-slate-700">{brief.later}</p>
        </div>
      </div>
    </div>
  )
}

function ReteachRecommendationCard({ item }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="break-words text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">{item.topic}</p>
      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{item.reason}</p>
      <p className="mt-3 break-words text-sm font-semibold leading-6 text-slate-900">{item.recommended_move}</p>
    </div>
  )
}

function SignalCard({ signal }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">{signal.severity} signal</span>
      </div>
      <h4 className="mt-3 break-words text-base font-bold text-slate-950">{signal.title}</h4>
      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{signal.detail}</p>
      {signal.target_url ? (
        <div className="mt-4">
          <Link href={signal.target_url} className="btn btn-outline w-full sm:w-auto">
            Review
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function TextBulletSection({ title, items }) {
  if (!items?.length) return null

  return (
    <div className="min-w-0 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-5">
      <p className="section-kicker text-[#18181b]">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="break-words">• {item}</li>
        ))}
      </ul>
    </div>
  )
}

function FocusReasonCard({ title, heading, reason }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="section-kicker text-[#18181b]">{title}</p>
      <h4 className="mt-2 break-words text-xl font-bold text-slate-950">{heading}</h4>
      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{reason}</p>
    </div>
  )
}

export default function ClassroomIntelligencePanel({ intelligence, role = 'student', variant = 'stream' }) {
  const teacherView = intelligence?.teacher_view
  const studentView = intelligence?.student_view
  const isTeacher = role === 'educator' || role === 'admin'
  const summary = isTeacher ? teacherView?.overview_summary : studentView?.overview_summary
  const confidenceReason = isTeacher ? teacherView?.confidence_reason : studentView?.confidence_reason

  if (!summary) return null

  const eyebrow = isTeacher ? 'AI Classroom Intelligence' : 'AI Classroom Intelligence'
  const title = isTeacher ? 'Classroom Command Center' : 'Student Focus Board'
  const subtitle = isTeacher
    ? 'See what the class is struggling with, who needs attention, and what to reteach next.'
    : 'See the class focus, your personal weak point, and the best next study moves before the next checkpoint.'

  return (
    <div className="card min-w-0 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl min-w-0">
          <p className="section-kicker text-[#18181b]">{eyebrow}</p>
          <h3 className="mt-2 break-words text-3xl font-bold text-slate-950">{title}</h3>
          <p className="mt-3 break-words text-sm leading-7 text-slate-600">{subtitle}</p>
          <p className="mt-4 break-words text-sm leading-7 text-slate-700">{summary}</p>
          {confidenceReason ? (
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-[#18181b]">{confidenceReason}</p>
          ) : null}
        </div>
        <FocusTopics topics={(isTeacher ? teacherView?.focus_topics : studentView?.focus_topics) || []} />
      </div>

      {isTeacher ? (
        <div className={`mt-6 grid gap-6 ${variant === 'classwork' ? '2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]' : ''}`}>
          <div className="space-y-6">
            <BriefCard brief={teacherView?.teacher_brief} />

            <div>
              <p className="section-kicker text-[#18181b]">Class patterns</p>
              <TextBulletSection title="Signal summary" items={teacherView?.class_pattern_summary || []} />
            </div>

            <div>
              <p className="section-kicker text-[#18181b]">Reteach recommendations</p>
              <div className="mt-3 grid gap-3">
                {(teacherView?.reteach_recommendations || []).map((item, index) => (
                  <ReteachRecommendationCard key={`${item.topic}-${index}`} item={item} />
                ))}
              </div>
            </div>

            <div>
              <p className="section-kicker text-[#18181b]">Recommended next steps</p>
              <div className="mt-3 grid gap-3">
                {(teacherView?.recommended_actions || []).map((action, index) => (
                  <ActionCard key={`${action.label}-${index}`} action={action} />
                ))}
              </div>
            </div>

            <TextBulletSection title="Meeting follow-up" items={teacherView?.meeting_follow_up || []} />
          </div>

          <div className="space-y-6">
            <div>
              <p className="section-kicker text-[#18181b]">Student focus groups</p>
              <div className="mt-3 grid gap-3">
                {(teacherView?.student_focus_groups || []).length ? (
                  teacherView.student_focus_groups.map((group, index) => (
                    <FocusGroupCard key={`${group.label}-${index}`} group={group} />
                  ))
                ) : (
                  <div className="surface-subtle min-w-0 p-4 text-sm text-slate-600">No learner groups need a special reteach track right now.</div>
                )}
              </div>
            </div>

            <div>
              <p className="section-kicker text-[#18181b]">Attention signals</p>
              <div className="mt-3 grid gap-3">
                {(teacherView?.attention_signals || []).length ? (
                  teacherView.attention_signals.map((signal, index) => (
                    <SignalCard key={`${signal.title}-${index}`} signal={signal} />
                  ))
                ) : (
                  <div className="surface-subtle min-w-0 p-4 text-sm text-slate-600">No urgent classroom signals right now.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`mt-6 grid gap-6 ${variant === 'classwork' ? '2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]' : ''}`}>
          <div className="space-y-6">
            <div>
              <p className="section-kicker text-[#18181b]">Study targets</p>
              <div className="mt-3 grid gap-3">
                {(studentView?.study_targets || []).map((action, index) => (
                  <ActionCard key={`${action.label}-${index}`} action={action} ctaLabel="Open" />
                ))}
              </div>
            </div>

            <div>
              <p className="section-kicker text-[#18181b]">Next best moves</p>
              <div className="mt-3 grid gap-3">
                {(studentView?.next_steps || []).map((action, index) => (
                  <ActionCard key={`${action.label}-${index}`} action={action} ctaLabel="Go" />
                ))}
              </div>
            </div>

            <TextBulletSection title="Recent class takeaways" items={studentView?.key_takeaways || []} />
            <TextBulletSection title="Ask next" items={studentView?.ask_next || []} />
          </div>

          <div className="space-y-6">
            <FocusReasonCard
              title="Class focus"
              heading={(studentView?.focus_topics || [])[0] || 'Stay aligned with the current class focus'}
              reason={studentView?.class_focus_reason || 'Use the latest classroom signals to keep your revision aligned with what the class is doing right now.'}
            />
            <FocusReasonCard
              title="Personal focus"
              heading={studentView?.personalized_focus || 'Stay aligned with the class focus'}
              reason={studentView?.personal_focus_reason || 'Your personal next step is to reinforce the same topic the class is currently emphasizing.'}
            />
          </div>
        </div>
      )}
    </div>
  )
}
