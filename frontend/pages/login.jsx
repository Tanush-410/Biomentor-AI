import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { GraduationCap, School2 } from 'lucide-react'

import Footer from '../components/Footer'
import StemEducationBadge from '../components/StemEducationBadge'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

const ROLE_MODES = [
  {
    value: 'student',
    label: 'Student Mode',
    icon: GraduationCap
  },
  {
    value: 'educator',
    label: 'Educator Mode',
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
  const [slowLoading, setSlowLoading] = useState(false)
  const [error, setError] = useState('')
  const [heroImageFailed, setHeroImageFailed] = useState(false)

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
    setSlowLoading(false)
    setError('')

    const slowTimer = setTimeout(() => setSlowLoading(true), 4000)

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
      clearTimeout(slowTimer)
      setLoading(false)
      setSlowLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(10,10,10,0.06),_transparent_35%),linear-gradient(135deg,_#d9c25c,_#e3ce7a_52%,_#dcc26a)] text-zinc-950">
      <header className="border-b border-black/10 bg-white/55 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <StemEducationBadge className="border-black/15 bg-white/70" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.35em] text-zinc-700">VYDRA CORE</p>
          </div>
          <Link href="/" className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-black hover:bg-black hover:text-[#d9c25c]">
            Back Home
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-8">
          {!heroImageFailed && (
            <div className="overflow-hidden rounded-[32px] border border-black/10 shadow-2xl shadow-black/10">
              <Image
                src="/stem-education-hero.png"
                alt=""
                width={1037}
                height={653}
                className="h-auto w-full"
                priority
                onError={() => setHeroImageFailed(true)}
              />
            </div>
          )}

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
                      ? 'border-black bg-black/8 shadow-lg shadow-black/15'
                      : 'border-black/10 bg-white/40 hover:border-black/30 hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-3 ${active ? 'bg-black text-[#d9c25c]' : 'bg-zinc-100 text-zinc-700'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-950">{item.label}</h3>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[32px] border border-black/10 bg-white/55 p-8 shadow-2xl shadow-black/10 backdrop-blur">
          <h3 className="text-2xl font-bold text-zinc-950">Sign in to continue</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            You are signing in with <span className="font-semibold text-zinc-950">{mode === 'student' ? 'Student Mode' : 'Educator Mode'}</span>.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-2xl border border-black/20 bg-black/5 px-4 py-3 text-sm text-zinc-950">
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

            <label className="flex items-center gap-3 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-black/20 bg-white accent-black"
              />
              Remember my email on this device
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-zinc-950 px-5 py-3 font-semibold text-[#d9c25c] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Signing in...' : `Enter ${mode === 'student' ? 'Student' : 'Educator'} Workspace`}
            </button>

            {slowLoading && (
              <p className="text-center text-xs leading-5 text-zinc-600">
                Still working -- the server can take up to a minute to wake up if it has been idle. Please wait, no need to refresh.
              </p>
            )}
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
            <Link href="/forgot-password" className="text-zinc-950 hover:text-zinc-600">
              Forgot Password?
            </Link>
            <span className="text-zinc-400">•</span>
            <Link href="/register" className="text-zinc-950 hover:text-zinc-600">
              Create account
            </Link>
          </div>
        </section>
      </main>

      <Footer className="border-black/10 bg-white/55 backdrop-blur" />
    </div>
  )
}
