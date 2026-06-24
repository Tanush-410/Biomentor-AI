import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('landing page contains the refreshed product positioning hooks', () => {
  const source = fs.readFileSync(new URL('../pages/index.jsx', import.meta.url), 'utf8')

  assert.match(source, /const brandWords = \[/)
  assert.match(source, /S.+marter/s)
  assert.match(source, /L.+earning/s)
  assert.match(source, /S.+tarts/s)
  assert.match(source, /H.+ere\./s)
  assert.match(source, /study from your own material/i)
  assert.match(source, /classroom-ready/i)
  assert.match(source, /proctored/i)
  assert.match(source, /AI Meeting Assistant/)
  assert.match(source, /AI Educator Copilot/)
  assert.match(source, /AI Study Coach/)
  assert.match(source, /Material Intelligence/)
  assert.match(source, /Exam Maker/)
  assert.match(source, /Anticheat Bot/)
  assert.match(source, /Certifications/)
  assert.match(source, /Sticky notes/)
})
