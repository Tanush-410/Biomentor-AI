import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { requestBackendJson } from '../lib/backendApi'

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student', hint: 'Upload study material, practice quizzes, and track Bloom’s progress.' },
  { value: 'educator', label: 'Educator', hint: 'Monitor classes, launch live sessions, and assign interventions.' }
]

export default function Register() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'student',
    institution_name: '',
    focus_area: '',
    class_code: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await requestBackendJson('/auth/register', {
        method: 'POST',
        body: {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          institution_name: formData.institution_name || null,
          focus_area: formData.focus_area || null,
          class_code: formData.class_code || null
        }
      })

      router.push(`/login?mode=${formData.role}`)
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,_#ffffff,_#f4f4f5_45%,_#e4e4e7)] px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500">VYDRA CORE</p>
            <h1 className="mt-2 text-4xl font-bold text-slate-950">Create your workspace</h1>
          </div>
          <Link href="/login" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-black hover:bg-zinc-950 hover:text-[#d9c25c]">
            Back to login
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-[32px] bg-[linear-gradient(180deg,#d9c25c_0%,#a88a26_100%)] p-8 text-zinc-950 shadow-xl shadow-zinc-300/40">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-300">Role Selection</p>
            <h2 className="mt-4 text-3xl font-bold">Pick the mode you want to grow into.</h2>
            <div className="mt-8 space-y-4">
              {ROLE_OPTIONS.map((option) => {
                const active = formData.role === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, role: option.value }))}
                    className={`w-full rounded-[24px] border p-5 text-left transition ${
                      active
                        ? 'border-white bg-white/12'
                        : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    <h3 className="text-lg font-bold">{option.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{option.hint}</p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/70">
            <h2 className="text-2xl font-bold text-slate-950">Account details</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {formData.role === 'student'
                ? 'Students can optionally add a classroom code from an educator to join class analytics later.'
                : 'Educators can add institution and focus details so the new dashboard feels tailored from day one.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-900">
                  {error}
                </div>
              )}

              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Full Name"
                className="input"
                required
              />

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email"
                className="input"
                required
              />

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  name="institution_name"
                  value={formData.institution_name}
                  onChange={handleChange}
                  placeholder="Institution name"
                  className="input"
                />
                <input
                  type="text"
                  name="focus_area"
                  value={formData.focus_area}
                  onChange={handleChange}
                  placeholder={formData.role === 'educator' ? 'Subject focus or department' : 'Exam or topic focus'}
                  className="input"
                />
              </div>

              {formData.role === 'student' && (
                <input
                  type="text"
                  name="class_code"
                  value={formData.class_code}
                  onChange={handleChange}
                  placeholder="Optional educator classroom code"
                  className="input"
                />
              )}

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password (minimum 8 characters)"
                className="input"
                required
              />

              <input
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="Confirm Password"
                className="input"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-zinc-950 px-5 py-3 font-semibold text-[#d9c25c] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Creating account...' : `Create ${formData.role === 'student' ? 'Student' : 'Educator'} Account`}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
