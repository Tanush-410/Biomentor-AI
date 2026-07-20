import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { BarChart3, BrainCircuit, Target, TrendingUp } from 'lucide-react'

import AppShell from '../components/AppShell'
import AISpotlightBanner from '../components/AISpotlightBanner'
import CircularProgress from '../components/CircularProgress'
import { StudyCoachActionList, StudyCoachPanel } from '../components/StudyCoachPanel'
import { useAuth } from '../context/AuthContext'
import { getMyCertificates } from '../lib/classroomApi'
import { requestBackendJson } from '../lib/backendApi'

const LEVEL_COLORS = {
  1: 'stroke-slate-500',
  2: 'stroke-[#c9ab3f]',
  3: 'stroke-[#f2e9c4]',
  4: 'stroke-[#f2e9c4]',
  5: 'stroke-[#c9ab3f]',
  6: 'stroke-[#c9ab3f]'
}

export default function ProgressPage() {
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [progress, setProgress] = useState(null)
  const [coachProgress, setCoachProgress] = useState(null)
  const [certificates, setCertificates] = useState(null)
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
      const [progressPayload, coachPayload, certificatePayload] = await Promise.all([
        requestBackendJson('/quiz/progress', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        requestBackendJson('/study-coach/progress', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        getMyCertificates(token)
      ])
      setProgress(progressPayload)
      setCoachProgress(coachPayload)
      setCertificates(certificatePayload)
    } catch (err) {
      console.error('Progress load error:', err)
      setError(err.message || 'Unable to connect to the server.')
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
          <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">
            {error}
          </div>
        )}

        <AISpotlightBanner
          eyebrow="Progress AI Surface"
          title="Progress Strategy Board"
          description="Your progress page now behaves like an AI planning board: it explains what the scores mean, which Bloom levels need recovery first, and what sequence gives you the strongest next improvement."
          highlights={['Bloom mastery strategy', 'Checkpoint guidance', 'Practice order']}
          primaryAction={{ label: 'Open Progress Coach', href: '#progress-coach' }}
          secondaryAction={{ label: 'Jump to Bloom Mastery', href: '#bloom-mastery' }}
          status="Use this board before starting the next quiz so you practice with intent instead of repeating the same weak cycle."
        />

        <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SummaryCard icon={<BrainCircuit className="w-5 h-5" />} label="Quizzes Completed" value={progress?.totalQuizzes || 0} />
          <SummaryCard icon={<Target className="w-5 h-5" />} label="Average Score" value={`${Math.round(progress?.averageScore || 0)}%`} />
          <SummaryCard icon={<BarChart3 className="w-5 h-5" />} label="Questions Answered" value={progress?.totalQuestionsAnswered || 0} />
          <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="Tracked Levels" value={bloomStats.filter((item) => item.count > 0).length} />
        </section>

        <section className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          <div id="bloom-mastery" className="card p-6">
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
                        progressClassName={LEVEL_COLORS[item.level] || 'stroke-[#c9ab3f]'}
                        trackClassName="stroke-[#d4d4d8]"
                        tone="text-[#18181b]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Certificates and active tracks</h2>
              {loading ? (
                <p className="text-slate-500">Loading certification progress...</p>
              ) : (
                <div className="space-y-4">
                  {(certificates?.earned_certifications || []).length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Earned certificates</p>
                      {certificates.earned_certifications.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.classroom_name || 'Classroom certification'} · {item.course_mode === 'external_course' ? 'External + VYDRA CORE' : 'VYDRA CORE track'}</p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            {item.issued_certificate_id ? (
                              <Link href={`/certificate/${item.issued_certificate_id}`} className="btn btn-outline">
                                View certificate
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {(certificates?.active_certifications || []).length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Active certification tracks</p>
                      {certificates.active_certifications.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.classroom_name || 'Classroom certification'}</p>
                          <p className="mt-3 text-sm text-slate-600">{Math.round(item.completion_percentage || 0)}% complete · {item.status.replaceAll('_', ' ')}</p>
                          <div className="mt-4">
                            <Link href={`/classrooms/${item.classroom_id}/certification/${item.id}`} className="btn btn-outline">
                              Continue track
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {(!certificates?.earned_certifications?.length && !certificates?.active_certifications?.length) ? (
                    <div className="surface-subtle p-4 text-sm text-slate-600">
                      Your classroom certifications will appear here after an educator publishes one for you.
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div id="progress-coach">
              <StudyCoachPanel
                title="Practice guidance"
                summary={coachProgress?.summary || 'The coach interprets your weakest Bloom levels so you know what to practice next.'}
                confidenceReason={coachProgress?.confidence_reason}
                actionLabel="Open Learning Chat"
                actionHref="/learning-chat"
                studyMode={coachProgress?.study_mode}
                modeReason={coachProgress?.mode_reason}
                dailyGoal={coachProgress?.checkpoint_goal}
              >
                {coachProgress ? (
                  <>
                    {coachProgress?.checkpoint_goal ? (
                      <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Checkpoint goal</p>
                        <p className="mt-3 text-base font-bold text-slate-950">{coachProgress.checkpoint_goal.label}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{coachProgress.checkpoint_goal.reason}</p>
                      </div>
                    ) : null}
                    {(coachProgress.practice_order || []).length > 0 ? (
                      <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Recommended practice order</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {coachProgress.practice_order.map((item) => (
                            <span key={item} className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
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
            </div>

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
      <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f5] px-3 py-1 text-[#18181b] text-sm font-semibold">
        {icon}
        {label}
      </div>
      <p className="text-4xl font-bold text-slate-900 mt-5">{value}</p>
    </div>
  )
}
