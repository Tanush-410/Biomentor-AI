import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { GraduationCap, School2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

const ROLE_MODES = [
  {
    value: 'student',
    label: 'Student Mode',
    description: 'Study uploaded material, practice Bloom’s quizzes, and track progress.',
    icon: GraduationCap
  },
  {
    value: 'educator',
    label: 'Educator Mode',
    description: 'Monitor classes, launch live sessions, and assign reinforcement tasks.',
    icon: School2
  }
]

export default function Login() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [mode, setMode] = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const savedEmail = localStorage.getItem('biomentor_remember_email')
    const savedMode = localStorage.getItem('biomentor_login_mode')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
    if (savedMode) {
      setMode(savedMode)
    }
    if (typeof router.query.mode === 'string') {
      setMode(router.query.mode)
    }
  }, [router.query.mode])

  const redirectForRole = (role) => {
    if (role === 'educator' || role === 'admin') {
      router.push('/dashboard')
      return
    }
    router.push('/dashboard')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await requestBackendJson('/auth/login', {
        method: 'POST',
        body: { email, password, desired_role: mode }
      })

      if (!data?.access_token || !data?.user) {
        throw new Error('The server returned an incomplete login response. Please try again.')
      }

      login(data.access_token, data.user)

      if (rememberMe) {
        localStorage.setItem('biomentor_remember_email', email)
      } else {
        localStorage.removeItem('biomentor_remember_email')
      }
      localStorage.setItem('biomentor_login_mode', mode)
      redirectForRole(data.user?.role)
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(191,148,103,0.2),_transparent_35%),linear-gradient(135deg,_#2e2118,_#5f4028_52%,_#8a5a36)] text-white">
      <header className="border-b border-white/10 bg-[#2f2218]/50 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f0dcc6]">BioMentor AI</p>
            <h1 className="mt-2 text-2xl font-bold">Exam Preparation Workspace</h1>
          </div>
          <Link href="/" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-stone-100 transition hover:border-[#f0dcc6] hover:text-[#f0dcc6]">
            Back Home
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-89px)] max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-8">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f0dcc6]">Secure Sign In</p>
            <h2 className="mt-4 text-5xl font-bold leading-tight text-white">
              Choose the right mode and enter the part of BioMentor built for you.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Students get study, quiz, and progress tools. Educators unlock class dashboards, live collaboration, alerts, and intervention workflows.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {ROLE_MODES.map((item) => {
              const Icon = item.icon
              const active = mode === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  className={`rounded-[28px] border p-5 text-left transition ${
                    active
                      ? 'border-[#f0dcc6] bg-white/12 shadow-lg shadow-[#2f2218]/25'
                      : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-3 ${active ? 'bg-[#f0dcc6] text-[#4d3220]' : 'bg-[#2f2218] text-[#f0dcc6]'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{item.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[#2f2218]/55 p-8 shadow-2xl shadow-[#2f2218]/30 backdrop-blur">
          <h3 className="text-2xl font-bold text-white">Sign in to continue</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            You are signing in with <span className="font-semibold text-[#f0dcc6]">{mode === 'student' ? 'Student Mode' : 'Educator Mode'}</span>.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="input-auth"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-auth"
              required
            />

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#f0dcc6]"
              />
              Remember my email on this device
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-gradient-to-r from-[#d4b08d] via-[#b9895d] to-[#8a5a36] px-5 py-3 font-semibold text-[#2f2218] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Signing in...' : `Enter ${mode === 'student' ? 'Student' : 'Educator'} Workspace`}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Link href="/forgot-password" className="text-[#f0dcc6] hover:text-white">
              Forgot Password?
            </Link>
            <span className="text-slate-500">•</span>
            <Link href="/register" className="text-[#f0dcc6] hover:text-white">
              Create account
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
