import React from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function AISpotlightBanner({
  eyebrow = 'AI Workspace',
  title,
  description,
  highlights = [],
  primaryAction,
  secondaryAction,
  status
}) {
  return (
    <section className="card relative overflow-hidden border-[#d4d4d8] bg-[radial-gradient(circle_at_top_right,_rgba(0,0,0,0.08),_transparent_32%),linear-gradient(145deg,#fafafa_0%,#f4f4f5_45%,#ffffff_100%)] p-8 shadow-lg shadow-zinc-200/40">
      <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-[#d4d4d8]/30 blur-3xl" />
      <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-[#e4e4e7] blur-3xl" />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d4d4d8] bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#18181b]">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          {description ? (
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">{description}</p>
          ) : null}

          {highlights.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {highlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#d4d4d8] bg-white/80 px-3 py-1 text-sm font-semibold text-[#3f3f46]"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 xl:max-w-sm">
          {status ? (
            <div className="rounded-[24px] border border-[#d4d4d8] bg-white/80 p-4 text-sm leading-6 text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Why this matters</p>
              <p className="mt-3">{status}</p>
            </div>
          ) : null}

          {(primaryAction || secondaryAction) ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {primaryAction ? (
                <Link href={primaryAction.href} className="btn btn-primary inline-flex items-center gap-2">
                  {primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              {secondaryAction ? (
                <Link href={secondaryAction.href} className="btn btn-outline">
                  {secondaryAction.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
