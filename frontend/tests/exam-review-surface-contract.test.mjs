import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('exam review workspace exposes a teacher release flow', () => {
  const source = fs.readFileSync(new URL('../pages/educator/exam-review/[examId].jsx', import.meta.url), 'utf8')

  assert.match(source, /Teacher grading review/)
  assert.match(source, /Release summary/i)
  assert.match(source, /Finalize Teacher Review/)
  assert.match(source, /Release reviewed score/i)
  assert.match(source, /Next student requiring review/i)
  assert.match(source, /Show only pending teacher review/i)
  assert.match(source, /Question navigator/i)
  assert.match(source, /Teacher release checklist/i)
})

test('classwork surfaces direct educator review entry points for exams', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/classwork.jsx', import.meta.url), 'utf8')

  assert.match(source, /Open grading desk|Review exam submissions/i)
  assert.match(source, /anticheat-bot|Anti-?cheat/i)
})
