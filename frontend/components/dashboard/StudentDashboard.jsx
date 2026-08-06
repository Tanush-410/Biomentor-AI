import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, BookOpen, Brain, FileText, Sparkles } from 'lucide-react'

import AppShell from '../AppShell'
import AISpotlightBanner from '../AISpotlightBanner'
import CircularProgress from '../CircularProgress'
import StatCard from '../StatCard'
import { StudyCoachActionList, StudyCoachPanel } from '../StudyCoachPanel'
import { useAuth } from '../../context/AuthContext'
import { fetchBackendWithFallback, readErrorDetail } from '../../lib/backendApi'
import RecentScoresChart from './RecentScoresChart'
import DashboardTabs from './DashboardTabs'

const BLOOM_LABELS = {
  1: 'Remember',
  2: 'Understand',
  3: 'Apply',
  4: 'Analyze',
  5: 'Evaluate',
  6: 'Create'
}

export default function StudentDashboard() {
  const { token, user } = useAuth()
  const [studentData, setStudentData] = useState({ documents: [], progress: null, studyPlan: null })
  const [studyCoach, setStudyCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    loadStudentDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const weakAreas = useMemo(() => {
    const progress = studentData.progress
    if (!progress?.bloomLevelStats) return []

    return Object.entries(progress.bloomLevelStats)
      .map(([level, stats]) => ({
        level: Number(level),
        name: stats.name || BLOOM_LABELS[Number(level)],
        average: Math.round(stats.average || 0),
        count: stats.count || 0
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => a.average - b.average)
      .slice(0, 3)
  }, [studentData.progress])

  const recommendations = useMemo(() => {
    const { studyPlan, progress, documents } = studentData
    if (studyPlan) {
      return [...(studyPlan.immediate || []), ...(studyPlan.short_term || [])].slice(0, 4)
    }
    if (!progress) return []
    const items = []
    if (weakAreas[0]) {
      items.push(`Focus on ${weakAreas[0].name} questions next to strengthen your weakest Bloom's level.`)
    }
    if ((progress.totalQuestionsAnswered || 0) === 0) {
      items.push('Upload your first material and generate a quiz to begin tracking progress.')
    }
    if ((documents || []).length > 0 && user?.role !== 'student') {
      items.push('Use Check Difficulty to convert your own questions across Bloom’s Taxonomy levels.')
    }
    return items.slice(0, 3)
  }, [studentData, weakAreas, user])

  const loadStudentDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const [documentsResponse, progressResponse, recommendationsResponse, coachResponse] = await Promise.all([
        fetchBackendWithFallback('/documents/', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/quiz/progress', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/recommendations/study-plan', { headers: { Authorization: `Bearer ${token}` } }),
        fetchBackendWithFallback('/study-coach/overview', { headers: { Authorization: `Bearer ${token}` } })
      ])

      const documents = documentsResponse.ok ? await documentsResponse.json() : []
      const progress = progressResponse.ok ? await progressResponse.json() : null
      const recommendationsPayload = recommendationsResponse.ok ? await recommendationsResponse.json() : null
      const coachPayload = coachResponse.ok ? await coachResponse.json() : null

      setStudentData({
        documents,
        progress,
        studyPlan: recommendationsPayload?.recommendations || null
      })
      setStudyCoach(coachPayload)

      if (!documentsResponse.ok && !progressResponse.ok && !recommendationsResponse.ok) {
        setError(
          (await readErrorDetail(documentsResponse))
          || (await readErrorDetail(progressResponse))
          || (await readErrorDetail(recommendationsResponse))
          || 'We could not load your dashboard right now.'
        )
      }
    } catch (err) {
      console.error('Student dashboard load error:', err)
      setError('Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  const documents = studentData.documents
  const progress = studentData.progress

  return (
    <AppShell
      title="Learning Dashboard"
      description="See your uploaded study material, Bloom's quiz performance, and the next actions that keep your exam prep moving."
      contentClassName="space-y-8"
      actions={
        <>
          <Link href="/student/classrooms" className="btn btn-outline">Classroom</Link>
          <Link href="/documents" className="btn btn-outline">Materials</Link>
          <Link href="/start-quiz" className="btn btn-primary">Generate Quiz</Link>
          <Link href="/learning-chat" className="btn btn-outline">Learning Chat</Link>
        </>
      }
    >
      {error && <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900">{error}</div>}

      {/* At a glance */}
      <section>
        <h2 className="section-kicker text-zinc-500">At a glance</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Materials" value={documents.length} accent="bg-[#d4d4d8] text-[#3f3f46]" icon={<BookOpen className="w-5 h-5" />} />
          <StatCard label="Quizzes" value={progress?.totalQuizzes || 0} accent="bg-[#f4f4f5] text-[#18181b]" icon={<Brain className="w-5 h-5" />} />
          <StatCard label="Avg Score" value={`${Math.round(progress?.averageScore || 0)}%`} accent="bg-[#e4e4e7] text-[#18181b]" icon={<BarChart3 className="w-5 h-5" />} />
          <StatCard label="Questions" value={progress?.totalQuestionsAnswered || 0} accent="bg-zinc-200 text-zinc-700" icon={<Sparkles className="w-5 h-5" />} />
        </div>
      </section>

      <DashboardTabs
        defaultTab="overview"
        tabs={[
          {
            key: 'overview',
            label: 'Overview',
            content: (
              <section className="grid gap-6 lg:grid-cols-3">
                <div className="card p-6 lg:col-span-2">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Knowledge Gaps</h3>
                      <p className="text-sm text-slate-600">Weakest Bloom’s Taxonomy levels based on your quiz history.</p>
                    </div>
                    <Link href="/progress" className="text-sm font-semibold text-[#18181b] hover:text-[#3f3f46]">Open Progress</Link>
                  </div>

                  {loading ? (
                    <p className="text-slate-500">Loading your progress...</p>
                  ) : weakAreas.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                      No quiz performance data yet. Generate your first quiz from uploaded material to populate knowledge gaps.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {weakAreas.map((area) => (
                        <div key={area.level} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Level {area.level}</p>
                              <h4 className="text-lg font-bold text-slate-900">{area.name}</h4>
                              <p className="text-sm text-slate-600">{area.count} answered questions recorded at this level.</p>
                            </div>
                            <CircularProgress
                              value={area.average}
                              size={82}
                              stroke={8}
                              label="Average score"
                              caption={`${area.count} answers`}
                              progressClassName="stroke-[#c9ab3f]"
                              trackClassName="stroke-[#d4d4d8]"
                              tone="text-[#18181b]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card p-6">
                  <h3 className="mb-1 text-xl font-bold text-slate-900">Recent Quiz Scores</h3>
                  <p className="mb-4 text-sm text-slate-600">Your last {Math.min(progress?.recentQuizzes?.length || 0, 5)} completed quizzes.</p>
                  <RecentScoresChart quizzes={progress?.recentQuizzes || []} />
                </div>
              </section>
            ),
          },
          {
            key: 'study-coach',
            label: 'Study Coach',
            content: (
              <StudyCoachPanel
                title="Study Coach Command"
                summary={studyCoach?.rationale || 'The coach uses your live quiz history and uploaded material to tell you what to do next.'}
                confidenceReason={studyCoach?.confidence_reason}
                actionLabel="Open Full Progress Plan"
                actionHref="/progress"
                studyMode={studyCoach?.study_mode}
                modeReason={studyCoach?.mode_reason}
                dailyGoal={studyCoach?.daily_goal}
                weeklyPlan={studyCoach?.weekly_plan}
                recoveryPath={studyCoach?.recovery_path}
              >
                {studyCoach ? (
                  <>
                    <div className="rounded-2xl border border-[#d4d4d8] bg-[#fafafa] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Next best move</p>
                      <p className="mt-3 text-lg font-bold text-slate-950">{studyCoach.next_action}</p>
                    </div>
                    {studyCoach?.daily_goal ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Today’s goal</p>
                        <p className="mt-3 text-base font-bold text-slate-950">{studyCoach.daily_goal.label}</p>
                      </div>
                    ) : null}
                    <StudyCoachActionList actions={studyCoach.short_plan} />
                    {(studyCoach.weak_focus_areas || []).length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18181b]">Weak focus areas</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {studyCoach.weak_focus_areas.map((area) => (
                            <span key={area} className="role-pill border-[#d4d4d8] bg-[#f4f4f5] text-[#18181b]">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="surface-subtle p-4 text-sm text-slate-600">
                    Complete a quiz or upload material to unlock your guided study flow.
                  </div>
                )}
              </StudyCoachPanel>
            ),
          },
          {
            key: 'next-steps',
            label: 'Next Steps',
            content: (
              <>
                <section className="card p-6">
                  <h3 className="mb-4 text-xl font-bold text-slate-900">Recommended Next Steps</h3>
                  {recommendations.length === 0 ? (
                    <p className="text-slate-600">Start by uploading material and taking one quiz.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {recommendations.map((item, index) => (
                        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">{item}</div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    {user?.role !== 'student' && (
                      <Link href="/check-difficulty" className="btn btn-outline inline-flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" />
                        Check Question Difficulty
                      </Link>
                    )}
                    <Link href="/start-quiz" className="btn btn-primary inline-flex items-center justify-center gap-2">
                      <Brain className="h-4 w-4" />
                      Start Bloom’s Quiz
                    </Link>
                  </div>
                </section>

                <AISpotlightBanner
                  eyebrow="Student AI Surface"
                  title="AI Mission Control"
                  description="The coach decides what to practice next, the material engine explains what matters, and the chat switches into reasoning mode when your questions get harder."
                  highlights={['Adaptive study coach', 'Material intelligence', 'Reasoning chat']}
                  primaryAction={{ label: 'Open Progress Plan', href: '/progress' }}
                  secondaryAction={{ label: 'Material Intelligence', href: '/documents#material-intelligence-studio' }}
                />
              </>
            ),
          },
        ]}
      />
    </AppShell>
  )
}
