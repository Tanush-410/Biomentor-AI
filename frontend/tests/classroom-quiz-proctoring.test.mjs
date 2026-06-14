import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('classroom quiz still guards tab hide, fullscreen exit, and camera access', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/quiz/[quizId].jsx', import.meta.url), 'utf8')
  assert.match(source, /handleViolation\('tab_hidden'/)
  assert.match(source, /handleViolation\('fullscreen_exit'/)
  assert.match(source, /Camera access is required/)
  assert.match(source, /beforeunload/)
  assert.match(source, /contextmenu/)
  assert.match(source, /keydown/)
  assert.match(source, /heartbeatClassroomQuizAttempt/)
  assert.match(source, /availability_state === 'published'/)
  assert.match(source, /FaceDetector/)
  assert.match(source, /reportClassroomQuizWarning/)
  assert.match(source, /ai_proctoring_debarred/)
  assert.match(source, /parseServerDate/)
  assert.match(source, /available_until/)
})
