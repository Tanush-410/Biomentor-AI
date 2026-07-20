import React, { useState } from 'react'
import Link from 'next/link'

import { requestBackendJson } from '../lib/backendApi'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const payload = await requestBackendJson('/auth/forgot-password', {
        method: 'POST',
        body: { email }
      })
      setMessage(payload?.message || 'If an account exists for that email, a reset link has been sent.')
      setEmail('')
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Please try again.')
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
            <h1 className="mt-2 text-4xl font-bold text-zinc-950">Reset your password</h1>
          </div>
          <Link href="/login" className="btn btn-outline">Back to login</Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="card bg-[linear-gradient(180deg,#d9c25c_0%,#a88a26_100%)] p-8 text-zinc-950">
            <p className="section-kicker text-[#fafafa]">Account recovery</p>
            <h2 className="mt-4 text-3xl font-bold">Get back into your learning workspace without friction.</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-200">
              Enter the email tied to your student or educator account and we’ll send a reset link so you can return to your materials, classes, and progress.
            </p>
          </section>

          <section className="card p-8">
            <h2 className="text-2xl font-bold text-zinc-950">Send reset link</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Use the email associated with your VYDRA CORE account.</p>

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
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="input"
                required
              />

              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
