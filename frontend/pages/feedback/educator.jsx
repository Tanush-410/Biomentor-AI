import React from 'react'
import AppShell from '../../components/AppShell'
import FeedbackWorkspace from '../../components/FeedbackWorkspace'

export default function EducatorFeedbackPage() {
  return (
    <AppShell
      eyebrow="Educator Feedback"
      title="Feedback across every classroom you teach"
      description="See feedback from students in all of your classrooms in one place, filter it by class, and send feedback of your own."
    >
      <FeedbackWorkspace />
    </AppShell>
  )
}
