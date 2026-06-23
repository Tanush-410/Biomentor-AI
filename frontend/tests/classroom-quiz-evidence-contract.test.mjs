import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('classroom quiz proctoring captures evidence snapshots for warnings and violations', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/quiz/[quizId].jsx', import.meta.url), 'utf8')

  assert.match(source, /captureEvidenceSnapshot/)
  assert.match(source, /waitForEvidenceVideoFrame/)
  assert.match(source, /await waitForEvidenceVideoFrame\(video/)
  assert.match(source, /evidence_image_data_url/)
  assert.match(source, /reportClassroomQuizWarning/)
  assert.match(source, /reportClassroomQuizViolation/)
  assert.match(source, /canvas\.toDataURL/)
  assert.match(source, /warning_type: type/)
})

test('classroom exam hard proctoring events terminate with evidence-ready snapshots', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/exam/[examId].jsx', import.meta.url), 'utf8')

  assert.match(source, /captureEvidenceSnapshot/)
  assert.match(source, /waitForEvidenceVideoFrame/)
  assert.match(source, /await waitForEvidenceVideoFrame\(video/)
  assert.match(source, /handleViolation\('tab_hidden'/)
  assert.match(source, /handleViolation\('window_blur'/)
  assert.match(source, /handleViolation\('fullscreen_exit'/)
  assert.match(source, /evidence_image_data_url/)
  assert.match(source, /canvas\.toDataURL/)
})
