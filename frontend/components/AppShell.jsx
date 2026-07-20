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
  MessageCircle,
  Box,
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
  { href: '/collaboration-hub', label: 'Collaboration', icon: MessageSquare, match: ['/collaboration-hub'] },
  { href: '/3d-studio', label: '3D Studio', icon: Box, match: ['/3d-studio'] },
  { href: '/feedback/student', label: 'Feedback', icon: MessageCircle, match: ['/feedback/student'] }
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
  { href: '/admin/analytics', label: 'Admin Analytics', icon: FileStack, match: ['/admin/analytics'], adminOnly: true },
  { href: '/3d-studio', label: '3D Studio', icon: Box, match: ['/3d-studio'] },
  { href: '/feedback/educator', label: 'Feedback', icon: MessageCircle, match: ['/feedback/educator'] }
]

function isActiveItem(item, pathname) {
  return item.match.some((pattern) => pathname === pattern)
}

export default function AppShell({ title, eyebrow = 'VYDRA CORE', description = '', actions = null, children, contentClassName = '' }) {
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
            ? 'bg-zinc-950 text-[#d9c25c] shadow-md shadow-black/10'
            : 'text-zinc-800 hover:bg-black/5 hover:text-zinc-950'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!compact && <span>{item.label}</span>}
      </Link>
    )
  }

  return (
    <div className={`min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f4f4f5_42%,#e4e4e7_100%)] md:grid ${sidebarWidthClass}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white/95 p-3 text-zinc-950 shadow-lg shadow-black/10 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation overlay"
          />
          <aside className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-[#d9c25c] text-zinc-950 shadow-2xl">
            <div className="flex items-start justify-between border-b border-black/10 px-6 py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-700">VYDRA CORE</p>
                <h2 className="mt-3 text-2xl font-bold text-zinc-950">{workspaceTitle}</h2>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-zinc-600">{roleLabel}</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl border border-black/10 p-2 text-zinc-700 transition hover:bg-black/5"
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

            <div className="border-t border-black/10 p-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:border-black/30 hover:bg-black/5"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden border-r border-black/10 bg-[#d9c25c] text-zinc-950 md:flex md:min-h-screen md:flex-col">
        <div className={`border-b border-black/10 py-6 ${isCollapsed ? 'px-3' : 'px-6'}`}>
          <div className={`flex ${isCollapsed ? 'justify-center' : 'items-start justify-between gap-3'}`}>
            <div className={isCollapsed ? 'hidden' : 'block'}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-700">VYDRA CORE</p>
              <h2 className="mt-3 text-2xl font-bold text-zinc-950">{workspaceTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{roleSupportCopy}</p>
              <div className="role-pill mt-4 border-black/10 bg-black/5 text-zinc-800">
                {roleLabel}
              </div>
            </div>

            {isCollapsed && (
              <div className="rounded-2xl bg-black/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-800">
                VC
              </div>
            )}

            <button
              onClick={() => setIsCollapsed((current) => !current)}
              className={`rounded-xl border border-black/10 p-2 text-zinc-700 transition hover:bg-black/5 ${
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
                className="rounded-xl border border-black/10 p-2 text-zinc-700 transition hover:bg-black/5"
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
          <div className="mx-4 mb-4 rounded-[24px] border border-black/10 bg-black/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600">Workspace Focus</p>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              {user?.role === 'student'
                ? 'Keep materials, chat, quizzes, and progress moving in a single guided loop.'
                : 'Move from alerts to intervention with fewer clicks and clearer next actions.'}
            </p>
          </div>
        )}

        <div className={`border-t border-black/10 p-4 ${isCollapsed ? 'px-3' : ''}`}>
          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex w-full items-center rounded-2xl border border-black/10 text-sm font-semibold text-zinc-800 transition hover:border-black/30 hover:bg-black/5 ${
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
          <section className="relative mb-8 overflow-hidden rounded-[28px] border border-zinc-200/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(244,244,245,0.96),rgba(228,228,231,0.9))] p-6 shadow-lg shadow-black/5 sm:p-8">
            <div className="pointer-events-none absolute -right-12 top-0 h-32 w-32 rounded-full bg-zinc-300/30 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-black/5 blur-3xl" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="section-kicker text-zinc-500">{eyebrow}</p>
                <h1 className="mt-2 text-3xl font-bold text-zinc-950 sm:text-4xl">{title}</h1>
                {description && <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base">{description}</p>}
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
