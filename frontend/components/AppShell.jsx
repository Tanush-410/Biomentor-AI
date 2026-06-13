import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  BarChart3,
  BookOpen,
  Brain,
  FileStack,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'

const STUDENT_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { href: '/classrooms', label: 'Classroom', icon: Users, match: ['/classrooms', '/classrooms/[id]', '/classrooms/[id]/stream', '/classrooms/[id]/classwork', '/classrooms/[id]/people', '/classrooms/[id]/messages', '/classrooms/[id]/live', '/classrooms/[id]/live/[meetingId]', '/classrooms/[id]/live/[meetingId]/room', '/classrooms/[id]/quiz/[quizId]', '/classrooms/[id]/exam/[examId]', '/classrooms/[id]/certification/[certificationId]'] },
  { href: '/documents', label: 'Materials', icon: BookOpen, match: ['/documents', '/document/[id]', '/certificate/[certificateId]'] },
  { href: '/learning-chat', label: 'Learning Chat', icon: MessageSquare, match: ['/learning-chat'] },
  { href: '/start-quiz', label: 'Quiz Generator', icon: Brain, match: ['/start-quiz', '/quiz-session'] },
  { href: '/progress', label: 'Progress', icon: BarChart3, match: ['/progress'] },
  { href: '/collaboration-hub', label: 'Collaboration', icon: MessageSquare, match: ['/collaboration-hub'] }
]

const EDUCATOR_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { href: '/classrooms', label: 'Classrooms', icon: BookOpen, match: ['/classrooms', '/classrooms/[id]', '/classrooms/[id]/stream', '/classrooms/[id]/classwork', '/classrooms/[id]/people', '/classrooms/[id]/messages', '/classrooms/[id]/live', '/classrooms/[id]/live/[meetingId]', '/classrooms/[id]/live/[meetingId]/room', '/classrooms/[id]/quiz/[quizId]', '/classrooms/[id]/exam/[examId]', '/classrooms/[id]/certification/[certificationId]'] },
  { href: '/educator/quiz-maker', label: 'Quiz Maker', icon: Brain, match: ['/educator/quiz-maker'] },
  { href: '/educator/exam-maker', label: 'Exam Maker', icon: FileStack, match: ['/educator/exam-maker'] },
  { href: '/educator/certification', label: 'Certification', icon: BookOpen, match: ['/educator/certification'] },
  { href: '/educator/anticheat-bot', label: 'Anticheat Bot', icon: MessageSquare, match: ['/educator/anticheat-bot'] },
  { href: '/check-difficulty', label: 'Bloom Studio', icon: Brain, match: ['/check-difficulty'] },
  { href: '/educator/class-insights', label: 'Class Insights', icon: BarChart3, match: ['/educator/class-insights'] },
  { href: '/communication-hub', label: 'Communication Hub', icon: MessageSquare, match: ['/communication-hub'] },
  { href: '/collaboration-hub', label: 'Collaboration', icon: Brain, match: ['/collaboration-hub'] },
  { href: '/admin/analytics', label: 'Admin Analytics', icon: FileStack, match: ['/admin/analytics'], adminOnly: true }
]

function isActiveItem(item, pathname) {
  return item.match.some((pattern) => pathname === pattern)
}

export default function AppShell({ title, eyebrow = 'BioMentor AI', description = '', actions = null, children, contentClassName = '' }) {
  const router = useRouter()
  const { logout, user } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navItems = (user?.role === 'educator' || user?.role === 'admin' ? EDUCATOR_NAV_ITEMS : STUDENT_NAV_ITEMS)
    .filter((item) => !item.adminOnly || user?.role === 'admin')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedState = window.localStorage.getItem('biomentor-sidebar-collapsed')
    setIsCollapsed(savedState === 'true')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('biomentor-sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [router.pathname])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const sidebarWidthClass = isCollapsed
    ? 'md:grid-cols-[88px_minmax(0,1fr)]'
    : 'md:grid-cols-[280px_minmax(0,1fr)]'

  const sidebarPaddingClass = isCollapsed ? 'px-3' : 'px-4'
  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'educator' ? 'Educator' : 'Student'
  const workspaceTitle = user?.role === 'admin'
    ? 'Admin Command'
    : user?.role === 'educator'
      ? 'Educator Command'
      : 'Student Workspace'
  const roleSupportCopy = user?.role === 'student'
    ? 'Study materials, quizzes, progress, and educator support in one focused space.'
    : 'Classes, Bloom authoring, interventions, and live session control in one place.'

  const renderNavLink = (item, compact = false) => {
    const Icon = item.icon
    const active = isActiveItem(item, router.pathname)

    return (
      <Link
        key={`${compact ? 'compact' : 'full'}-${item.href}`}
        href={item.href}
        title={item.label}
        className={`flex items-center rounded-2xl text-sm font-semibold transition ${
          compact ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
        } ${
          active
            ? 'bg-[#eadac9] text-[#4d3220] shadow-md shadow-stone-950/10'
            : 'text-stone-300 hover:bg-[#3b2b20] hover:text-[#f6ecdf]'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!compact && <span>{item.label}</span>}
      </Link>
    )
  }

  return (
    <div className={`min-h-screen bg-[linear-gradient(180deg,#fbf5ee_0%,#f7efe4_42%,#f3e6d6_100%)] md:grid ${sidebarWidthClass}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-[rgba(255,251,247,0.96)] p-3 text-stone-900 shadow-lg md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close navigation overlay"
          />
          <aside className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-[#2f2218] text-stone-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#4a3829] px-6 py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#d5b08b]">BioMentor AI</p>
                <h2 className="mt-3 text-2xl font-bold text-white">{workspaceTitle}</h2>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-stone-400">{roleLabel}</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl border border-[#5a4737] p-2 text-stone-200 transition hover:bg-[#3b2b20]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6">
              <div className="space-y-2">
                {navItems.map((item) => renderNavLink(item))}
              </div>
            </nav>

            <div className="border-t border-[#4a3829] p-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#5a4737] px-4 py-3 text-sm font-semibold text-stone-100 transition hover:border-[#8d6b51] hover:bg-[#3b2b20]"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden border-r border-[#d8c5b2] bg-[#2f2218] text-stone-100 md:flex md:min-h-screen md:flex-col">
        <div className={`border-b border-[#4a3829] py-6 ${isCollapsed ? 'px-3' : 'px-6'}`}>
          <div className={`flex ${isCollapsed ? 'justify-center' : 'items-start justify-between gap-3'}`}>
            <div className={isCollapsed ? 'hidden' : 'block'}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#d5b08b]">BioMentor AI</p>
              <h2 className="mt-3 text-2xl font-bold text-white">{workspaceTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-400">{roleSupportCopy}</p>
              <div className="role-pill mt-4 border-[#b28a67]/30 bg-[#8a5a36]/18 text-[#e9cfb5]">
                {roleLabel}
              </div>
            </div>

            {isCollapsed && (
              <div className="rounded-2xl bg-[#8a5a36]/16 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#e9cfb5]">
                BM
              </div>
            )}

            <button
              onClick={() => setIsCollapsed((current) => !current)}
              className={`rounded-xl border border-[#5a4737] p-2 text-stone-200 transition hover:bg-[#3b2b20] ${
                isCollapsed ? 'absolute left-1/2 -translate-x-1/2 opacity-0 pointer-events-none' : ''
              }`}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {isCollapsed && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setIsCollapsed(false)}
                className="rounded-xl border border-[#5a4737] p-2 text-stone-200 transition hover:bg-[#3b2b20]"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <nav className={`flex-1 py-6 ${sidebarPaddingClass}`}>
          <div className="space-y-2">
            {navItems.map((item) => renderNavLink(item, isCollapsed))}
          </div>
        </nav>

        {!isCollapsed && (
          <div className="mx-4 mb-4 rounded-[24px] border border-white/8 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">Workspace Focus</p>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              {user?.role === 'student'
                ? 'Keep materials, chat, quizzes, and progress moving in a single guided loop.'
                : 'Move from alerts to intervention with fewer clicks and clearer next actions.'}
            </p>
          </div>
        )}

        <div className={`border-t border-[#4a3829] p-4 ${isCollapsed ? 'px-3' : ''}`}>
          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex w-full items-center rounded-2xl border border-[#5a4737] text-sm font-semibold text-stone-100 transition hover:border-[#8d6b51] hover:bg-[#3b2b20] ${
              isCollapsed ? 'justify-center px-3 py-3' : 'justify-center gap-2 px-4 py-3'
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && 'Logout'}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <main id="main-content" className={`mx-auto max-w-[92rem] px-4 pb-8 pt-24 sm:px-6 md:pt-8 lg:px-8 ${contentClassName}`}>
          <section className="relative mb-8 overflow-hidden rounded-[28px] border border-stone-200/90 bg-[linear-gradient(145deg,rgba(255,251,247,0.98),rgba(248,239,228,0.96),rgba(244,232,217,0.9))] p-6 shadow-lg shadow-stone-200/60 sm:p-8">
            <div className="pointer-events-none absolute -right-12 top-0 h-32 w-32 rounded-full bg-[#dfc0a1]/22 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-[#c89a70]/14 blur-3xl" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="section-kicker text-[#8a5a36]">{eyebrow}</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{title}</h1>
                {description && <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>}
              </div>
              {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  )
}
