import React, { useState } from 'react'
import { requestBackendJson } from '../lib/backendApi'

export default function QuickCheckCard({ quickCheck, token }) {
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSelect = (questionId, optionId) => {
    setSelectedAnswers((current) => ({ ...current, [questionId]: optionId }))
  }

  const handleSubmit = async () => {
    if (!quickCheck?.questions?.length) return
    setSubmitting(true)
    try {
      const payload = await requestBackendJson('/qa/quick-check/evaluate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          quick_check_id: quickCheck.id,
          quick_check: quickCheck,
          answers: quickCheck.questions.map((question) => ({
            question_id: question.id,
            selected_option_id: selectedAnswers[question.id] || ''
          }))
        }
      })
      setFeedback(payload)
    } catch (error) {
      console.error('Quick check evaluation failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#d4d4d8] bg-[#fafafa] px-4 py-4">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#18181b]">Quick Check</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">{quickCheck.title}</h3>
      </div>

      <div className="space-y-4">
        {quickCheck.questions.map((question, index) => (
          <div key={question.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="font-semibold text-slate-900">{index + 1}. {question.prompt}</p>
            <div className="mt-3 space-y-2">
              {question.options.map((option) => (
                <label key={option.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={selectedAnswers[question.id] === option.id}
                    onChange={() => handleSelect(question.id, option.id)}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSubmit} disabled={submitting} className="btn btn-primary">
          {submitting ? 'Checking...' : 'Test Me'}
        </button>
        {feedback ? (
          <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-900">
            Score: {feedback.score}/{feedback.total_questions} · {feedback.next_step}
          </div>
        ) : null}
      </div>

      {feedback?.results?.length ? (
        <div className="mt-4 space-y-3">
          {feedback.results.map((result) => (
            <div key={result.question_id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                {result.is_correct ? 'Correct' : 'Review this one'}
              </p>
              <p className="mt-1">{result.explanation}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
