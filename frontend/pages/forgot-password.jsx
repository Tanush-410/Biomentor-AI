import React, { useState } from 'react'
import Link from 'next/link'

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
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setMessage('Password reset link sent to your email.')
      setEmail('')
    } catch (err) {
      setError('Failed to send reset link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#fbf5ee,#f6ebdc_48%,#ead7c0)] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="section-kicker text-[#8a5a36]">VYDRA CORE</p>
            <h1 className="mt-2 text-4xl font-bold text-stone-950">Reset your password</h1>
          </div>
          <Link href="/login" className="btn btn-outline">Back to login</Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="card bg-[linear-gradient(180deg,#3b281c_0%,#62412b_100%)] p-8 text-white">
            <p className="section-kicker text-[#f0dcc6]">Account recovery</p>
            <h2 className="mt-4 text-3xl font-bold">Get back into your learning workspace without friction.</h2>
            <p className="mt-4 text-sm leading-7 text-stone-200">
              Enter the email tied to your student or educator account and we’ll send a reset link so you can return to your materials, classes, and progress.
            </p>
          </section>

          <section className="card p-8">
            <h2 className="text-2xl font-bold text-stone-950">Send reset link</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">Use the email associated with your VYDRA CORE account.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-[#d8c1aa] bg-[#f5ebdf] px-4 py-3 text-sm text-[#6d472d]">
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
