import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { BarChart3, BrainCircuit, Target, TrendingUp } from 'lucide-react'

import AppShell from '../components/AppShell'
import CircularProgress from '../components/CircularProgress'
import { StudyCoachActionList, StudyCoachPanel } from '../components/StudyCoachPanel'
import { useAuth } from '../context/AuthContext'

const LEVEL_COLORS = {
  1: 'stroke-slate-500',
  2: 'stroke-[#c9a27c]',
  3: 'stroke-[#b9895d]',
  4: 'stroke-[#d5b08b]',
  5: 'stroke-[#8a5a36]',
  6: 'stroke-[#5f4028]'
}

export default function ProgressPage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [progress, setProgress] = useState(null)
  const [coachProgress, setCoachProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
      return
    }
    fetchProgress()
  }, [authLoading, token])

  const bloomStats = useMemo(() => {
    if (!progress?.bloomLevelStats) return []

    return Object.entries(progress.bloomLevelStats)
      .map(([level, stats]) => ({
        level: Number(level),
        name: stats.name,
        count: stats.count || 0,
        average: Math.round(stats.average || 0)
      }))
      .sort((a, b) => a.level - b.level)
  }, [progress])

  const weakest = bloomStats
    .filter((item) => item.count > 0)
    .sort((a, b) => a.average - b.average)
    .slice(0, 2)

  const recommendations = useMemo(() => {
    if (!progress) return []
    const items = []
    if (weakest[0]) {
      items.push(`Prioritize ${weakest[0].name} practice next. It is currently your lowest-performing Bloom's level.`)
    }
    if (weakest[1]) {
      items.push(`Follow up with ${weakest[1].name} questions to strengthen higher-order understanding.`)
    }
    if ((progress.averageScore || 0) < 75) {
      items.push('Open your uploaded material in study view and review the explanation-rich sections before your next quiz.')
    }
    if ((progress.totalQuizzes || 0) === 0) {
      items.push('You have not completed a quiz yet. Generate one from your uploaded material to start tracking progress.')
    }
    return items.slice(0, 3)
  }, [progress, weakest])

  const fetchProgress = async () => {
    setLoading(true)
    setError('')
    try {
      const [response, coachResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/progress`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study-coach/progress`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ])

      if (response.ok) {
        const payload = await response.json()
        setProgress(payload)
        if (coachResponse.ok) {
          const coachPayload = await coachResponse.json()
          setCoachProgress(coachPayload)
        }
      } else {
        setError('Unable to load progress data.')
      }
    } catch (err) {
      console.error('Progress load error:', err)
      setError('Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell
      title="Progress Tracker"
      description="Track Bloom's Taxonomy mastery from real quiz history, review recent attempts, and focus on the levels that need the most attention."
      contentClassName="space-y-8"
      actions={
        <>
          <Link href="/documents" className="btn btn-outline">Open Materials</Link>
          <Link href="/start-quiz" className="btn btn-primary">Generate Another Quiz</Link>
        </>
      }
    >
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SummaryCard icon={<BrainCircuit className="w-5 h-5" />} label="Quizzes Completed" value={progress?.totalQuizzes || 0} />
          <SummaryCard icon={<Target className="w-5 h-5" />} label="Average Score" value={`${Math.round(progress?.averageScore || 0)}%`} />
          <SummaryCard icon={<BarChart3 className="w-5 h-5" />} label="Questions Answered" value={progress?.totalQuestionsAnswered || 0} />
          <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="Tracked Levels" value={bloomStats.filter((item) => item.count > 0).length} />
        </section>

        <section className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Bloom’s Taxonomy Mastery</h2>
            <p className="text-slate-600 mb-6">Performance grouped by cognitive level instead of hardcoded topic placeholders.</p>

            {loading ? (
              <p className="text-slate-500">Loading progress metrics...</p>
            ) : bloomStats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                No quiz data yet. Once you complete a quiz from your material, your Bloom’s progress will appear here.
              </div>
            ) : (
              <div className="space-y-4">
                {bloomStats.map((item) => (
                  <div key={item.level} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Level {item.level}</p>
                        <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                        <p className="text-sm text-slate-600">{item.count} recorded answers</p>
                      </div>
                      <CircularProgress
                        value={item.average}
                        size={86}
                        stroke={8}
                        label="Average score"
                        caption={`${item.count} answers recorded`}
                        progressClassName={LEVEL_COLORS[item.level] || 'stroke-[#8a5a36]'}
                        trackClassName="stroke-[#eee4da]"
                        tone="text-[#8a5a36]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <StudyCoachPanel
              title="Practice guidance"
              summary={coachProgress?.summary || 'The coach interprets your weakest Bloom levels so you know what to practice next.'}
              confidenceReason={coachProgress?.confidence_reason}
              actionLabel="Open Learning Chat"
              actionHref="/learning-chat"
            >
              {coachProgress ? (
                <>
                  {(coachProgress.practice_order || []).length > 0 ? (
                    <div className="rounded-2xl border border-[#ead8c6] bg-[#fff8f1] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a5a36]">Recommended practice order</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {coachProgress.practice_order.map((item) => (
                          <span key={item} className="role-pill border-[#ead8c6] bg-[#fbf2e8] text-[#8a5a36]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <StudyCoachActionList
                    actions={(coachProgress.recommendations || []).map((item) => ({
                      label: item,
                      reason: 'This order is based on your lowest-mastery Bloom levels.',
                      target_url: '/start-quiz'
                    }))}
                  />
                </>
              ) : (
                <div className="surface-subtle p-4 text-sm text-slate-600">
                  Your coach will start interpreting your progress once quiz results are available.
                </div>
              )}
            </StudyCoachPanel>

            <div className="card p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Recommendations</h2>
              {recommendations.length === 0 ? (
                <p className="text-slate-600">Your personalized study recommendations will appear after your first quiz.</p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((item, index) => (
                    <div key={index} className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 mt-6">
                <Link href="/documents" className="btn btn-outline">Open Materials</Link>
                <Link href="/start-quiz" className="btn btn-primary">Generate Another Quiz</Link>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Recent Quizzes</h2>
              {progress?.recentQuizzes?.length ? (
                <div className="space-y-3">
                  {progress.recentQuizzes.map((quiz, index) => (
                    <div key={`${quiz.date || 'quiz'}-${index}`} className="rounded-xl border border-slate-200 p-4">
                      <p className="font-semibold text-slate-900">{quiz.title}</p>
                      <p className="text-sm text-slate-600">{quiz.questionCount} questions · {Math.round(quiz.score || 0)}%</p>
                      {quiz.date && (
                        <p className="text-xs text-slate-500 mt-1">{new Date(quiz.date).toLocaleString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600">No completed quizzes yet.</p>
              )}
            </div>
          </div>
        </section>
    </AppShell>
  )
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="card p-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-[#f2e4d4] px-3 py-1 text-[#8a5a36] text-sm font-semibold">
        {icon}
        {label}
      </div>
      <p className="text-4xl font-bold text-slate-900 mt-5">{value}</p>
    </div>
  )
}
