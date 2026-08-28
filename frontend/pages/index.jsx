import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import ConstellationHero from '../components/landing/ConstellationHero'
import Footer from '../components/Footer'
import StemEducationBadge from '../components/StemEducationBadge'

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_15%_20%,rgba(0,0,0,0.05),transparent_45%),linear-gradient(150deg,#f4f4f5_0%,#e4e4e7_55%,#f4f4f5_100%)] text-zinc-950">
      <div className="fixed inset-0">
        <ConstellationHero className="h-full w-full" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-8 md:px-10 lg:px-16">
          <div>
            <StemEducationBadge />
            <p className="mt-3 text-2xl font-black uppercase tracking-[0.38em] text-zinc-800 md:text-3xl">VYDRA CORE</p>
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

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center gap-8 px-6 py-16 md:px-10 lg:px-16">
          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.04em] text-zinc-950 md:text-7xl">
            AI Quantum Learning Platform
          </h1>
          <p className="max-w-xl text-base font-semibold text-zinc-600 md:text-lg">
            An intelligent, AI-driven teaching and studying application.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href="/login?mode=student" className="btn bg-zinc-950 text-[#d9c25c] shadow-[0_16px_34px_rgba(0,0,0,0.2)] hover:bg-zinc-800">
              Start with VYDRA CORE <ArrowRight size={18} />
            </Link>
            <Link href="/login?mode=educator" className="btn border border-zinc-300 bg-white/70 text-zinc-950 hover:bg-white">
              Open educator workspace
            </Link>
          </div>
        </div>

        <Footer transparent />
      </div>
    </main>
  )
}
