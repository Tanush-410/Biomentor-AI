import React from 'react'
import AppShell from '../../components/AppShell'
import FeedbackWorkspace from '../../components/FeedbackWorkspace'

export default function StudentFeedbackPage() {
  return (
    <AppShell
      eyebrow="Student Feedback"
      title="Tell your educators how it's going"
      description="Send feedback straight to the educator of any classroom you're enrolled in, and see what they've sent back to you. Nothing leaves this app."
    >
      <FeedbackWorkspace />
    </AppShell>
  )
}
