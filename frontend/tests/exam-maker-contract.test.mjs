import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('exam maker exposes richer mini-word editor controls', () => {
  const source = fs.readFileSync(new URL('../pages/educator/exam-maker.jsx', import.meta.url), 'utf8')

  assert.match(source, /Exam Maker/)
  assert.match(source, /Manual document-style build/)
  assert.match(source, /AI-assisted question suggestions/)
  assert.match(source, /Fixed response boxes with AI grading cues/)
  assert.match(source, /Document preview/i)
  assert.match(source, /Drag to reorder/i)
  assert.match(source, /Upload diagram|Upload image/i)
  assert.match(source, /Image caption/i)
  assert.match(source, /Page break before block/i)
  assert.match(source, /Block library/i)
  assert.match(source, /Insert instruction/i)
  assert.match(source, /Insert section/i)
  assert.match(source, /Insert diagram/i)
  assert.match(source, /Answer box preview/i)
})
