import React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  MessageSquare,
  School2,
  ShieldCheck,
  Sparkles
} from 'lucide-react'

export default function HomePage() {
  const heroWords = ['Smarter', 'Learning', 'Starts', 'Here.']
  const flowSteps = [
    {
      index: '01',
      title: 'Study from your own material',
      description: 'Upload PDFs or notes, reopen them offline, and ask AI questions from the same source base.'
    },
    {
      index: '02',
      title: 'Practice and track performance',
      description: 'Generate quizzes, review answer quality, and monitor progress across real Bloom-level performance.'
    },
    {
      index: '03',
      title: 'Support classrooms in real time',
      description: 'Educators run classrooms, publish assessments, respond to messages, and intervene when students need help.'
    }
  ]

  const studentPoints = [
    'Study from your own material with offline-ready PDFs and AI explanations.',
    'Practice with quizzes generated from the same source material you are learning from.',
    'Track performance and return to the exact materials that need more review.'
  ]

  const educatorPoints = [
    'Run classroom-ready spaces with materials, announcements, messages, and live coordination.',
    'Create quizzes manually or from study material, then publish them with schedule and proctoring controls.',
    'Monitor performance, respond quickly, and step in when learners raise concerns or show risk signals.'
  ]

  const capabilityCards = [
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: 'Study from your own material',
      description: 'Turn uploaded PDFs and notes into a reusable study system instead of jumping between disconnected tools.'
    },
    {
      icon: <School2 className="h-5 w-5" />,
      title: 'Classroom-ready workflows',
      description: 'Bring students, educators, materials, and communication into one organized classroom flow.'
    },
    {
      icon: <Brain className="h-5 w-5" />,
      title: 'Proctored quiz delivery',
      description: 'Publish timed quizzes with answer-key grading, scheduling, and protected attempt rules.'
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: 'Progress and intervention',
      description: 'Move from performance signals to targeted support with progress, alerts, and educator follow-through.'
    }
  ]

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf5ee_0%,#f7efe4_44%,#f2e2cf_100%)]">
      <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-[rgba(255,251,247,0.94)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold uppercase tracking-[0.32em] text-[#8a5a36] md:text-xl">BioMentor AI</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-slate-950 md:text-4xl">
              {heroWords.map((word, index) => {
                const first = word.charAt(0)
                const rest = word.slice(1)
                return (
                  <span key={`${word}-${index}`} className="mr-[0.32em] inline-block">
                    <span className="text-[#B45309]">{first}</span>
                    <span className="text-slate-950">{rest}</span>
                  </span>
                )
              })}
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-outline">Login</Link>
            <Link href="/register" className="btn btn-primary">Create Account</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="card overflow-hidden bg-[linear-gradient(150deg,#332217_0%,#5d3d28_54%,#8a5a36_100%)] p-8 text-white shadow-2xl shadow-stone-200/70">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f0dcc6] md:text-base">Adaptive Learning Workspace</p>
            <h2 className="mt-4 max-w-4xl text-5xl font-bold leading-tight">
              Study from your own material, run classroom-ready assessment, and support learning from one connected system.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              BioMentor turns uploaded study material into AI-guided learning for students and classroom-ready assessment, intervention, and support workflows for educators.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary">
                Start with BioMentor
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login?mode=educator" className="btn border border-white/14 bg-white/10 text-white hover:bg-white/16">
                Enter Educator Mode
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <HeroSignal label="Study" value="AI learning chat + offline material" />
              <HeroSignal label="Assess" value="Manual and generated classroom quizzes" />
              <HeroSignal label="Support" value="Progress, messaging, and intervention" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker text-slate-500">Product flow</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">One platform that connects learning, assessment, and classroom response.</h3>
              </div>
              <div className="role-pill border-[#d8c1aa] bg-[#f3e6d8] text-[#7a5334]">Live app</div>
            </div>

            <div className="mt-6 space-y-4">
              {flowSteps.map((step) => (
                <FlowStep key={step.index} index={step.index} title={step.title} description={step.description} />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <ModeCard
            eyebrow="Student mode"
            title="An AI learning platform built around the material students already use."
            description="Students get a calmer revision loop with source-aware explanations, adaptive quiz practice, and progress that stays tied to the exact content they uploaded."
            accentClass="bg-[linear-gradient(180deg,#fffaf5_0%,#f5e8da_100%)]"
            points={studentPoints}
            ctaHref="/login?mode=student"
            ctaLabel="Open Student Mode"
            icon={<BookOpen className="h-5 w-5" />}
          />
          <ModeCard
            eyebrow="Educator mode"
            title="A classroom-ready exam preparation system for educators and teams."
            description="Educators move from classroom control to quiz delivery, communication, progress review, and intervention without leaving the same workspace."
            accentClass="bg-[linear-gradient(180deg,#3b281c_0%,#62412b_100%)] text-white border-[#4c3425]"
            dark
            points={educatorPoints}
            ctaHref="/login?mode=educator"
            ctaLabel="Open Educator Mode"
            icon={<School2 className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {capabilityCards.map((card) => (
            <CapabilityCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              description={card.description}
            />
          ))}
        </section>

        <section className="card p-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="section-kicker text-[#8a5a36]">Platform coverage</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-950">Built for individual learning, classroom delivery, and academic follow-through.</h3>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                The platform now connects study, assessment, communication, and intervention into one product flow for students, educators, and classroom teams.
              </p>
            </div>
            <div className="grid gap-3">
              <ProofRow icon={<MessageSquare className="h-4 w-4" />} text="Learning chat grounded in uploaded study material" />
              <ProofRow icon={<ShieldCheck className="h-4 w-4" />} text="Classroom messaging, live coordination, and educator alerts" />
              <ProofRow icon={<BarChart3 className="h-4 w-4" />} text="Manual and generated quizzes with progress-aware follow-through" />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function HeroSignal({ label, value }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f0dcc6]">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  )
}

function FlowStep({ index, title, description }) {
  return (
    <div className="surface-subtle p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a5a36]">{index}</p>
      <h4 className="mt-2 text-lg font-bold text-slate-950">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function CapabilityCard({ icon, title, description }) {
  return (
    <div className="card p-5">
      <div className="inline-flex rounded-2xl bg-[#f2e4d4] p-3 text-[#8a5a36]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function ModeCard({ eyebrow, title, description, points, ctaHref, ctaLabel, icon, accentClass, dark = false }) {
  return (
    <div className={`card p-6 ${accentClass}`}>
      <div className={`inline-flex rounded-2xl p-3 ${dark ? 'bg-white/10 text-[#f0dcc6]' : 'bg-[#f2e4d4] text-[#8a5a36]'}`}>
        {icon}
      </div>
      <p className={`section-kicker mt-5 ${dark ? 'text-[#f0dcc6]' : 'text-[#8a5a36]'}`}>{eyebrow}</p>
      <h3 className={`mt-2 text-3xl font-bold ${dark ? 'text-white' : 'text-slate-950'}`}>{title}</h3>
      <p className={`mt-4 text-sm leading-7 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{description}</p>

      <div className="mt-6 space-y-3">
        {points.map((point) => (
          <div
            key={point}
            className={`flex items-start gap-3 rounded-[20px] border px-4 py-3 ${
              dark ? 'border-white/10 bg-white/6 text-slate-100' : 'border-slate-200 bg-white/75 text-slate-700'
            }`}
          >
            <div className={`mt-1 h-2.5 w-2.5 rounded-full ${dark ? 'bg-[#f0dcc6]' : 'bg-[#8a5a36]'}`} />
            <p className="text-sm leading-6">{point}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link href={ctaHref} className={dark ? 'btn border border-white/14 bg-white/10 text-white hover:bg-white/16' : 'btn btn-outline'}>
          {ctaLabel}
        </Link>
      </div>
    </div>
  )
}

function ProofRow({ icon, text }) {
  return (
    <div className="surface-quiet flex items-start gap-3 p-4">
      <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div>
      <p className="text-sm leading-6 text-slate-700">{text}</p>
    </div>
  )
}
