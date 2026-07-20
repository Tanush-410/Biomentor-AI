import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

import { requestBackendJson } from '../lib/backendApi'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const token = typeof router.query.token === 'string' ? router.query.token : ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!token) {
      setError('This reset link is missing its token. Request a new one from the forgot password page.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const payload = await requestBackendJson('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: password }
      })
      setMessage(payload?.message || 'Your password has been reset. You can now log in.')
      setPassword('')
      setConfirmPassword('')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#ffffff,#f4f4f5_48%,#e4e4e7)] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="section-kicker text-[#18181b]">VYDRA CORE</p>
            <h1 className="mt-2 text-4xl font-bold text-zinc-950">Choose a new password</h1>
          </div>
          <Link href="/login" className="btn btn-outline">Back to login</Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="card bg-[linear-gradient(180deg,#d9c25c_0%,#a88a26_100%)] p-8 text-zinc-950">
            <p className="section-kicker text-[#fafafa]">Account recovery</p>
            <h2 className="mt-4 text-3xl font-bold">Set a new password to get back into your workspace.</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-200">
              This link is only valid for 30 minutes and can be used once. If it has expired, request a new one from the forgot password page.
            </p>
          </section>

          <section className="card p-8">
            <h2 className="text-2xl font-bold text-zinc-950">Reset your password</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Enter and confirm your new password below.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-900">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-[#d4d4d8] bg-[#e4e4e7] px-4 py-3 text-sm text-[#3f3f46]">
                  {message}
                </div>
              )}

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="input"
                minLength={8}
                required
              />

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="input"
                minLength={8}
                required
              />

              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
