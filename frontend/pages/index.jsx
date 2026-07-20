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
  Sparkles,
} from 'lucide-react'

export default function HomePage() {
  const brandWords = [
    { lead: 'S', rest: 'marter' },
    { lead: 'L', rest: 'earning' },
    { lead: 'S', rest: 'tarts' },
    { lead: 'H', rest: 'ere.' },
  ]

  const learningLoops = [
    {
      label: '01',
      title: 'Study from your own material',
      text: 'Upload PDFs, notes, and classroom material. VYDRA CORE turns them into searchable study context, summaries, quiz practice, and revision paths.',
    },
    {
      label: '02',
      title: 'Run classroom-ready assessment',
      text: 'Educators can schedule quizzes, proctored exams, fixed-answer papers, descriptive responses, and certificate-linked course work.',
    },
    {
      label: '03',
      title: 'Support live learning',
      text: 'Classrooms get live meetings, AI notes, student signals, messages, sticky notes, and intervention workflows in one connected space.',
    },
    {
      label: '04',
      title: 'Close the loop with proof',
      text: 'Progress, grading, anticheat evidence, certificates, and educator review surfaces keep learning outcomes visible and accountable.',
    },
  ]

  const aiSystems = [
    {
      title: 'AI Meeting Assistant',
      text: 'Joins the live learning flow with meeting notes, recap prompts, and class follow-up ideas.',
      icon: MessageSquare,
    },
    {
      title: 'AI Educator Copilot',
      text: 'Helps educators decide what to assign, who needs attention, and how to respond to classroom patterns.',
      icon: School2,
    },
    {
      title: 'AI Study Coach',
      text: 'Guides students through weak areas, upcoming work, and revision paths based on their own material.',
      icon: Brain,
    },
    {
      title: 'Material Intelligence',
      text: 'Transforms documents into summaries, concept maps, exam-focused study paths, and grounded answers.',
      icon: BookOpen,
    },
  ]

  const premiumFeatures = [
    {
      title: 'Exam Maker',
      text: 'A educator-first exam builder with structured paper sections, fixed response boxes, keywords, images, and AI-suggested questions.',
    },
    {
      title: 'Anticheat Bot',
      text: 'Proctored exam and quiz monitoring with warnings, evidence capture, educator review, and debarred-case records.',
    },
    {
      title: 'Certifications',
      text: 'Educators can attach course links or create course paths, then issue VYDRA CORE-branded certificates when students complete them.',
    },
    {
      title: 'Sticky notes',
      text: 'Private, colorful notes that stay pinned to the exact page position where students or educators created them.',
    },
  ]

  const audienceCards = [
    {
      title: 'For students',
      text: 'Study material, classroom work, live sessions, proctored attempts, progress, certificates, and private notes all live in one focused workspace.',
      action: 'Start student mode',
      href: '/login?mode=student',
    },
    {
      title: 'For educators',
      text: 'Create classrooms, schedule exams, launch meetings, review anticheat evidence, grade descriptive answers, and publish certificates.',
      action: 'Enter educator mode',
      href: '/login?mode=educator',
    },
  ]

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f4f5] text-[#09090b]">
      <section className="relative px-6 py-6 md:px-10 lg:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,0,0,0.08),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(63,63,70,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.75),rgba(228,228,231,0.58))]" />
        <div className="relative mx-auto max-w-7xl">
          <header className="flex flex-wrap items-center justify-between gap-5 border-b border-zinc-200 bg-white/80 px-1 py-7 backdrop-blur md:px-0">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.48em] text-zinc-700">VYDRA CORE</p>
              <h1 className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-4xl font-black leading-none tracking-[-0.06em] text-black md:text-5xl">
                {brandWords.map((word) => (
                  <span key={`${word.lead}${word.rest}`}>
                    <span className="text-zinc-950">{word.lead}</span>
                    {word.rest}
                  </span>
                ))}
              </h1>
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

          <div className="grid gap-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-[#d9c25c] p-7 text-zinc-950 shadow-[0_34px_90px_rgba(10,10,10,0.15)] md:p-10 lg:min-h-[620px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(10,10,10,0.06),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.35),transparent_45%)]" />
              <div className="relative z-10 flex h-full flex-col justify-between gap-14">
                <div>
                  <p className="section-kicker text-zinc-700">Adaptive learning workspace</p>
                  <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl lg:text-8xl">
                    Study, assess, meet, certify, and protect learning from one connected system.
                  </h1>
                  <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-zinc-700 md:text-xl">
                    VYDRA CORE is now the workspace where students study from your own material, educators run classroom-ready workflows, and every proctored quiz, exam, meeting, note, and certificate connects back to learning evidence.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <HeroSignal label="AI stack" value="Coach + Copilot + Meeting Assistant" />
                  <HeroSignal label="Assessment" value="Quizzes, exams, grading, anticheat" />
                  <HeroSignal label="Classroom" value="Live sessions, messages, materials" />
                  <HeroSignal label="Proof" value="Certificates, progress, evidence" />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/login?mode=student" className="btn bg-zinc-950 text-[#d9c25c] hover:bg-zinc-800">
                    Start with VYDRA CORE <ArrowRight size={18} />
                  </Link>
                  <Link href="/login?mode=educator" className="btn border border-black/30 bg-black/5 text-zinc-950 hover:bg-black/10">
                    Open educator workspace
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[2.25rem] border border-zinc-200 bg-white/85 p-7 shadow-[0_24px_70px_rgba(0,0,0,0.08)] md:p-9">
                <div className="flex items-center justify-between gap-4">
                  <p className="section-kicker">Product command center</p>
                  <span className="role-pill bg-zinc-100 text-zinc-950">Live app</span>
                </div>
                <h2 className="mt-5 max-w-xl text-3xl font-black leading-tight tracking-[-0.04em] md:text-4xl">
                  One premium platform for learning, assessment, classroom response, and proof.
                </h2>
                <div className="mt-7 space-y-4">
                  {learningLoops.map((step) => (
                    <FlowStep key={step.label} {...step} />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {audienceCards.map((card) => (
                  <ModeCard key={card.title} {...card} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-kicker">AI systems now visible</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-[-0.05em] md:text-6xl">
                The AI is not a side widget. It is the operating layer.
              </h2>
            </div>
            <p className="max-w-xl text-lg font-semibold leading-8 text-[#52525b]">
              Every major part of the app now has an AI role: teaching decisions, student coaching, material understanding, assessment quality, meeting recaps, and classroom intelligence.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {aiSystems.map((system) => (
              <AISystemCard key={system.title} {...system} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2.4rem] bg-[#d9c25c] p-8 text-zinc-950 shadow-[0_30px_90px_rgba(10,10,10,0.14)] md:p-10">
            <p className="section-kicker text-zinc-700">Assessment, proctoring, certificates</p>
            <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.05em] md:text-6xl">
              From classroom task to verified outcome.
            </h2>
            <p className="mt-6 text-lg font-semibold leading-8 text-zinc-300">
              VYDRA CORE now supports educator-built exams, AI-suggested papers, proctored attempts, anticheat review, rubric-backed grading, and completion certificates.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {premiumFeatures.map((feature, index) => (
              <FeatureBlock key={feature.title} index={index + 1} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16 pt-10 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white/85 shadow-[0_28px_90px_rgba(0,0,0,0.1)]">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="p-8 md:p-10">
              <p className="section-kicker">Why customers choose it</p>
              <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.05em] md:text-6xl">
                A school does not need another file locker. It needs a learning brain.
              </h2>
              <p className="mt-6 text-lg font-semibold leading-8 text-zinc-600">
                The landing page now reflects what the product has become: a premium, AI-forward classroom platform with real learning workflows instead of isolated tools.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/login?mode=educator" className="btn bg-zinc-950 text-[#d9c25c] hover:bg-zinc-800">
                  Build a classroom <ArrowRight size={18} />
                </Link>
                <Link href="/login?mode=student" className="btn border border-zinc-300 bg-white text-zinc-950 hover:border-black">
                  Study as a student
                </Link>
              </div>
            </div>
            <div className="grid gap-px bg-zinc-200 sm:grid-cols-2">
              <ProofCell title="Material to mastery" text="Upload, understand, practice, revise, and ask grounded questions from the same source base." />
              <ProofCell title="Educator command" text="Classwork, meetings, exams, grading, certificates, and interventions stay connected." />
              <ProofCell title="Protected assessment" text="Fullscreen, camera, tab switching, warnings, and Anticheat Bot evidence support review." />
              <ProofCell title="Learning memory" text="Sticky notes, progress signals, AI recaps, and classroom intelligence make the product feel alive." />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function HeroSignal({ label, value }) {
  return (
    <div className="rounded-[1.5rem] border border-black/15 bg-black/5 p-4 backdrop-blur">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.34em] text-zinc-700">{label}</p>
      <p className="mt-2 text-sm font-black leading-6 text-zinc-950">{value}</p>
    </div>
  )
}

function FlowStep({ label, title, text }) {
  return (
    <div className="rounded-[1.55rem] border border-zinc-200 bg-zinc-50/90 p-5">
      <div className="flex gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-black shadow-sm">{label}</span>
        <div>
          <h3 className="text-lg font-black text-black">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{text}</p>
        </div>
      </div>
    </div>
  )
}

function ModeCard({ title, text, action, href }) {
  return (
    <Link href={href} className="group rounded-[2rem] border border-zinc-200 bg-white/85 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.07)] transition hover:-translate-y-1 hover:border-black hover:bg-white">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-black">
        <School2 size={22} />
      </div>
      <h3 className="text-2xl font-black tracking-[-0.03em]">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{text}</p>
      <p className="mt-5 flex items-center gap-2 text-sm font-black text-black">
        {action} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
      </p>
    </Link>
  )
}

function AISystemCard({ title, text, icon: Icon }) {
  return (
    <article className="rounded-[2rem] border border-zinc-200 bg-white/85 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.07)]">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-[#d9c25c]">
        <Icon size={24} />
      </div>
      <h3 className="text-2xl font-black leading-tight tracking-[-0.04em]">{title}</h3>
      <p className="mt-4 text-sm font-semibold leading-6 text-zinc-600">{text}</p>
    </article>
  )
}

function FeatureBlock({ index, title, text }) {
  return (
    <article className="rounded-[2rem] border border-zinc-200 bg-white/85 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.07)]">
      <p className="mb-5 inline-flex rounded-full bg-zinc-100 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-black">
        {String(index).padStart(2, '0')}
      </p>
      <h3 className="text-3xl font-black leading-tight tracking-[-0.05em]">{title}</h3>
      <p className="mt-4 text-sm font-semibold leading-6 text-zinc-600">{text}</p>
    </article>
  )
}

function ProofCell({ title, text }) {
  return (
    <article className="bg-white p-7 md:p-8">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-black">
        {title.includes('Protected') ? <ShieldCheck size={21} /> : title.includes('Educator') ? <BarChart3 size={21} /> : title.includes('memory') ? <Sparkles size={21} /> : <BookOpen size={21} />}
      </div>
      <h3 className="text-2xl font-black tracking-[-0.04em]">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{text}</p>
    </article>
  )
}
