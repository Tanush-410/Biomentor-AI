import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('classroom quiz proctoring captures evidence snapshots for warnings and violations', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/quiz/[quizId].jsx', import.meta.url), 'utf8')

  assert.match(source, /captureEvidenceSnapshot/)
  assert.match(source, /evidence_image_data_url/)
  assert.match(source, /reportClassroomQuizWarning/)
  assert.match(source, /reportClassroomQuizViolation/)
  assert.match(source, /canvas\.toDataURL/)
  assert.match(source, /warning_type: type/)
})
