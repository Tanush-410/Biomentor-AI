import React from 'react'
import Link from 'next/link'

export default function MaterialIntelligencePanel({ intelligence, title = 'AI Material Intelligence', actionHref, actionLabel = 'Open Material' }) {
  if (!intelligence) return null

  return (
    <div className="card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker text-[#8a5a36]">AI Material Intelligence</p>
          <h3 className="mt-2 text-xl font-bold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{intelligence.summary}</p>
          {intelligence.confidence_reason ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#8a5a36]">{intelligence.confidence_reason}</p> : null}
        </div>
        {actionHref ? (
          <Link href={actionHref} className="btn btn-outline shrink-0">
            {actionLabel}
          </Link>
        ) : null}
      </div>

      {intelligence.prerequisite_warning ? (
        <div className="mt-5 rounded-2xl border border-[#ead8c6] bg-[#fff8f1] px-4 py-3 text-sm text-[#6d472d]">
          {intelligence.prerequisite_warning}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="section-kicker text-[#8a5a36]">Revision bullets</p>
            <div className="mt-3 space-y-3">
              {(intelligence.revision_bullets || []).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  • {item}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="section-kicker text-[#8a5a36]">Follow-up prompts</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(intelligence.follow_up_prompts || []).map((prompt) => (
                <span key={prompt} className="role-pill border-[#ead8c6] bg-[#fbf2e8] text-[#8a5a36]">
                  {prompt}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="section-kicker text-[#8a5a36]">Glossary</p>
            <div className="mt-3 space-y-3">
              {(intelligence.glossary || []).map((item) => (
                <div key={item.term} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-lg font-bold text-slate-950">{item.term}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="section-kicker text-[#8a5a36]">Quick flashcards</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {(intelligence.flashcards || []).map((card, index) => (
            <div key={`${card.prompt}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="text-base font-bold text-slate-950">{card.prompt}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
