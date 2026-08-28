import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Award,
  Bot,
  BookOpen,
  Brain,
  Clock,
  FileStack,
  FlaskConical,
  Mic,
  MessageCircle,
  MessageSquare,
  School2,
  ShieldCheck,
  StickyNote,
  Target,
  Users,
} from 'lucide-react'

import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'

const STUDY_FEATURES = [
  {
    icon: Mic,
    title: 'Voice-based Socratic tutor',
    text: 'A spoken, question-led study session in English, Hindi, Tamil, Telugu, or Kannada -- grounded in your own material, with a shared AI whiteboard. The tutor never gives the answer away; it asks the next question that gets you there.',
    href: '/socratic-tutor',
    linkLabel: 'Start a voice session',
  },
  {
    icon: MessageSquare,
    title: '24/7 question, answer, and feedback',
    text: 'An always-available adaptive learning loop grounded in mastery learning and formative assessment: ask a question in Learning Chat, get a source-grounded answer from your own material, and follow up with a quick check for immediate feedback.',
    href: '/learning-chat',
    linkLabel: 'Open Learning Chat',
  },
  {
    icon: Users,
    title: 'Virtual classroom STEM labs',
    text: 'Attend live classroom sessions and work through interactive 3D and simulation labs together -- Math Lab, Bio Lab, Quantum Lab, and 3D Studio can all be shared live during a class meeting.',
    href: '/collaboration-hub',
    linkLabel: 'Open Collaboration Hub',
  },
  {
    icon: FlaskConical,
    title: 'Self-study STEM labs',
    text: 'The same AI-driven 3D and simulation labs are available any time for independent practice -- graph and solve in Math Lab, model biological systems in Bio Lab, explore quantum circuits in Quantum Lab, or build in 3D Studio.',
    href: '/math-lab',
    linkLabel: 'Open Math Lab',
  },
  {
    icon: Target,
    title: 'SOLO-aligned quiz generation',
    text: "Quizzes generated from your uploaded material progress through SOLO Taxonomy levels -- from unistructural recall, to multistructural comprehension, to relational integration, to extended-abstract transfer -- so practice builds toward real mastery instead of stopping at recall.",
    href: '/start-quiz',
    linkLabel: 'Generate a SOLO quiz',
  },
  {
    icon: StickyNote,
    title: 'Sticky notes',
    text: 'Private, colorful notes that stay pinned to the exact page position where you created them -- available on every page, for students and educators alike.',
  },
  {
    icon: ShieldCheck,
    title: 'Anticheat Bot',
    text: 'Proctored exam and quiz monitoring with warnings, evidence capture, educator review, and debarred-case records, so protected assessments stay fair for everyone.',
  },
  {
    icon: MessageCircle,
    title: 'Feedback',
    text: 'A direct channel to tell us what is working and what needs attention, so the platform keeps improving around real classroom use.',
    hrefByRole: { student: '/feedback/student', educator: '/feedback/educator', admin: '/feedback/educator' },
    linkLabel: 'Send feedback',
  },
]

const EDUCATOR_FEATURES = [
  {
    icon: Brain,
    title: 'AI Meeting Assistant',
    text: 'Joins the live learning flow with meeting notes, recap prompts, and class follow-up ideas.',
  },
  {
    icon: School2,
    title: 'AI Educator Copilot',
    text: 'Helps you decide what to assign, who needs attention, and how to respond to classroom patterns.',
  },
  {
    icon: Bot,
    title: 'AI Study Coach',
    text: "Guides each student through weak areas, upcoming work, and revision paths based on their own material -- visible to you as an intervention signal.",
  },
  {
    icon: BookOpen,
    title: 'Material Intelligence',
    text: 'Transforms documents into summaries, concept maps, exam-focused study paths, and grounded answers.',
  },
  {
    icon: FileStack,
    title: 'Exam Maker',
    text: 'An educator-first exam builder with structured paper sections, fixed response boxes, keywords, images, and AI-suggested questions.',
    href: '/educator/exam-maker',
    linkLabel: 'Open Exam Maker',
  },
  {
    icon: ShieldCheck,
    title: 'Anticheat Bot',
    text: 'Proctored exam and quiz monitoring with warnings, evidence capture, educator review, and debarred-case records.',
    href: '/educator/anticheat-bot',
    linkLabel: 'Review anticheat cases',
  },
  {
    icon: Award,
    title: 'Certifications',
    text: 'Attach course links or build a course path, then issue VYDRA CORE-branded certificates when students complete it.',
    href: '/educator/certification',
    linkLabel: 'Open Certifications',
  },
  {
    icon: Clock,
    title: 'Automated progress reports',
    text: 'Reduces your working hours with automated, always-current progress reports on student performance instead of manual tracking.',
    href: '/educator/class-insights',
    linkLabel: 'Open Class Insights',
  },
]

function FeatureCard({ icon: Icon, title, text, href, hrefByRole, linkLabel, role }) {
  const resolvedHref = href || hrefByRole?.[role]
  return (
    <article className="card p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-[#d9c25c]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      {resolvedHref && (
        <Link href={resolvedHref} className="mt-4 inline-block text-sm font-semibold text-[#18181b] hover:text-[#3f3f46]">
          {linkLabel} →
        </Link>
      )}
    </article>
  )
}

export default function StemEducationPage() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const isEducator = user?.role === 'educator' || user?.role === 'admin'

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
    }
  }, [authLoading, token, router])

  if (authLoading || !token) return null

  return (
    <AppShell
      eyebrow="STEM Education"
      title="Personal study and virtual classroom, powered by AI-driven STEM labs"
      description="One connected system for self-study and live classroom learning: adaptive AI feedback, interactive 3D and simulation STEM labs, SOLO-aligned assessment, and the tools that keep protected assessment and progress visible."
    >
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STUDY_FEATURES.map((feature) => (
          <FeatureCard key={feature.title} {...feature} role={user?.role} />
        ))}
      </section>

      {isEducator && (
        <section className="mt-10">
          <div className="mb-5">
            <p className="section-kicker text-[#18181b]">For educators</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">The AI is not a side widget. It is the operating layer.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Every major part of VYDRA CORE now has an AI role: teaching decisions, student coaching, material understanding, assessment quality, meeting recaps, and classroom intelligence.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {EDUCATOR_FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} role={user?.role} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  )
}
