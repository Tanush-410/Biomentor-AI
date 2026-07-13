import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('educator certification studio exposes AI draft and publishing workflow', () => {
  const source = fs.readFileSync(new URL('../pages/educator/certification.jsx', import.meta.url), 'utf8')

  assert.match(source, /Certification Studio/)
  assert.match(source, /AI Suggest Milestones/)
  assert.match(source, /Save & Publish/)
  assert.match(source, /Certification composer/)
  assert.match(source, /Structured certification path/)
  assert.match(source, /Certificate preview/)
})

test('classroom certification detail page exposes learner and educator workflow', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/certification/[certificationId].jsx', import.meta.url), 'utf8')

  assert.match(source, /Certification Path/)
  assert.match(source, /Learner Progress/)
  assert.match(source, /Submit external completion proof/)
  assert.match(source, /Educator Review/)
  assert.match(source, /Issue certificate/)
  assert.match(source, /Certificate Outcome/)
})

test('certificate viewer exposes branded artifact details', () => {
  const source = fs.readFileSync(new URL('../pages/certificate/[certificateId].jsx', import.meta.url), 'utf8')

  assert.match(source, /VYDRA CORE Certificate/)
  assert.match(source, /Certificate of Completion/)
  assert.match(source, /Print \/ Save PDF/)
  assert.match(source, /Platform-backed completion artifact/)
  assert.match(source, /Export as PDF/)
})
