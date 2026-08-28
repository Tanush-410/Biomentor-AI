import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import Footer from '../components/Footer'
import StemEducationBadge from '../components/StemEducationBadge'

export default function HomePage() {
  const brandWords = [
    { lead: 'S', rest: 'marter' },
    { lead: 'L', rest: 'earning' },
    { lead: 'S', rest: 'tarts' },
    { lead: 'H', rest: 'ere.' },
  ]

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-[#f4f4f5] text-[#09090b]">
      <section className="relative flex flex-1 flex-col px-6 py-6 md:px-10 lg:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,0,0,0.08),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(63,63,70,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.75),rgba(228,228,231,0.58))]" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-5 border-b border-zinc-200 bg-white/80 px-1 py-7 backdrop-blur md:px-0">
            <div>
              <StemEducationBadge />
              <p className="mt-3 text-sm font-black uppercase tracking-[0.48em] text-zinc-700">VYDRA CORE</p>
              <h1 className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-4xl font-black leading-none tracking-[-0.06em] text-black md:text-5xl">
                {brandWords.map((word) => (
                  <span key={`${word.lead}${word.rest}`}>
                    <span className="text-zinc-950">{word.lead}</span>
                    {word.rest}
                  </span>
                ))}
              </h1>
              <p className="mt-3 text-sm font-semibold text-zinc-600 md:text-base">
                An intelligent, AI-driven teaching and studying application.
              </p>
            </div>
            <nav className="flex items-center gap-3">
              <Link href="/login" className="rounded-full border border-zinc-300 bg-white/90 px-6 py-3 text-sm font-black text-zinc-950 transition hover:-translate-y-0.5 hover:border-black">
                Login
              </Link>
              <Link href="/register" className="rounded-full bg-zinc-950 px-6 py-3 text-sm font-black text-[#d9c25c] shadow-[0_16px_34px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-zinc-800">
                Create Account
              </Link>
            </nav>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/login?mode=student" className="btn bg-zinc-950 text-[#d9c25c] hover:bg-zinc-800">
                Start with VYDRA CORE <ArrowRight size={18} />
              </Link>
              <Link href="/login?mode=educator" className="btn border border-black/30 bg-black/5 text-zinc-950 hover:bg-black/10">
                Open educator workspace
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
