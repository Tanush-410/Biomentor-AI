import React from 'react'
import Link from 'next/link'

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d4d4d8] bg-[#fafafa] p-4 text-sm leading-6 text-[#52525b]">
      {text}
    </div>
  )
}

function SectionCard({ kicker, title, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-[28px] border border-[#d4d4d8] bg-white p-5 ${className}`}>
      {kicker ? <p className="section-kicker text-[#18181b]">{kicker}</p> : null}
      {title ? <h4 className="mt-2 break-words text-xl font-bold text-slate-950">{title}</h4> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function MaterialIntelligencePanel({
  intelligence,
  title = 'AI Material Intelligence',
  actionHref,
  actionLabel = 'Open Material',
}) {
  if (!intelligence) return null

  const layered = intelligence.layered_summaries || {}
  const studyPath = intelligence.study_path || []
  const conceptMap = intelligence.concept_map || []
  const traps = intelligence.misconception_traps || []
  const vivaQuestions = intelligence.viva_questions || []
  const flashcards = intelligence.flashcards || []
  const followUps = intelligence.follow_up_prompts || []
  const glossary = intelligence.glossary || []
  const revisionBullets = intelligence.revision_bullets || []

  return (
    <div className="card min-w-0 overflow-hidden p-6 md:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl min-w-0">
          <p className="section-kicker text-[#18181b]">AI Material Intelligence</p>
          <h3 className="mt-3 break-words text-3xl font-bold text-slate-950">{title}</h3>
          <p className="mt-3 break-words text-base leading-7 text-slate-600">{intelligence.summary}</p>
          {intelligence.confidence_reason ? (
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">
              {intelligence.confidence_reason}
            </p>
          ) : null}
        </div>

        {actionHref ? (
          <Link href={actionHref} className="btn btn-primary shrink-0">
            {actionLabel}
          </Link>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard kicker="Layered Summary" title="Learn it at the depth you need">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Quick</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{layered.quick || intelligence.summary}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Standard</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{layered.standard || intelligence.summary}</p>
            </div>
            <div className="rounded-2xl border border-[#d4d4d8] bg-[#f4f4f5] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Exam Focus</p>
              <p className="mt-2 text-sm leading-6 text-[#3f3f46]">{layered.exam_focus || intelligence.summary}</p>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard kicker="Study Path" title="What to do next">
            {studyPath.length ? (
              <div className="space-y-3">
                {studyPath.map((step, index) => (
                  <div key={`${step.label}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c9ab3f] text-sm font-bold text-zinc-950">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h5 className="break-words text-base font-bold text-slate-950">{step.label}</h5>
                        <p className="mt-2 break-words text-sm leading-6 text-slate-600">{step.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="The study path will appear once enough document context is available." />
            )}
          </SectionCard>

          {intelligence.prerequisite_warning ? (
            <SectionCard kicker="Prerequisite Warning" title="Study this with context">
              <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-4 text-sm leading-6 text-[#3f3f46]">
                {intelligence.prerequisite_warning}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard kicker="Concept Map" title="How the main ideas connect">
          {conceptMap.length ? (
            <div className="space-y-3">
              {conceptMap.map((node) => (
                <div key={node.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h5 className="text-base font-bold text-slate-950">{node.label}</h5>
                    <span className="rounded-full bg-[#e4e4e7] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#18181b]">
                      {node.importance}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-600">Connects to</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(node.connects_to || []).length ? (
                      node.connects_to.map((item) => (
                        <span key={`${node.label}-${item}`} className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">Core anchor concept</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Concept links will appear when the document contains enough distinct study signals." />
          )}
        </SectionCard>

        <SectionCard kicker="Misconception Traps" title="What students often get wrong">
          {traps.length ? (
            <div className="space-y-3">
              {traps.map((item, index) => (
                <div key={`${item.concept}-${index}`} className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                  <h5 className="text-base font-bold text-slate-950">{item.concept}</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    <span className="font-semibold text-[#18181b]">Trap:</span> {item.trap}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    <span className="font-semibold text-[#18181b]">Correction:</span> {item.correction}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Misconception traps will appear once the AI can infer the likely problem spots in the material." />
          )}
        </SectionCard>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard kicker="Viva Questions" title="Oral-exam style prompts">
          {vivaQuestions.length ? (
            <div className="space-y-3">
              {vivaQuestions.map((item, index) => (
                <div key={`${item.question}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-base font-bold text-slate-950">{item.question}</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.expected_focus}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Viva-style prompts will appear when the AI has enough conceptual coverage to generate them." />
          )}
        </SectionCard>

        <SectionCard kicker="Revision Tools" title="Flashcards, glossary, and next prompts">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#18181b]">Revision bullets</p>
              <div className="mt-3 space-y-3">
                {revisionBullets.length ? (
                  revisionBullets.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                      • {item}
                    </div>
                  ))
                ) : (
                  <EmptyState text="Revision bullets will appear when the material has enough extracted structure." />
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#18181b]">Glossary</p>
              <div className="mt-3 grid gap-3">
                {glossary.length ? (
                  glossary.map((item) => (
                    <div key={item.term} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="text-base font-bold text-slate-950">{item.term}</h5>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.meaning}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState text="Glossary terms will appear after concept extraction." />
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#18181b]">Quick flashcards</p>
              <div className="mt-3 grid gap-3">
                {flashcards.length ? (
                  flashcards.map((card, index) => (
                    <div key={`${card.prompt}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="text-base font-bold text-slate-950">{card.prompt}</h5>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{card.answer}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState text="Flashcards will appear when the AI can detect strong recall targets in the material." />
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#18181b]">Follow-up prompts</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {followUps.length ? (
                  followUps.map((prompt) => (
                    <span key={prompt} className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
                      {prompt}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Follow-up prompts will appear once the AI has enough context.</span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
