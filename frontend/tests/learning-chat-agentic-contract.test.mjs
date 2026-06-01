import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('learning chat renders answer origin badges', () => {
  const source = fs.readFileSync(new URL('../pages/learning-chat.jsx', import.meta.url), 'utf8')

  assert.match(source, /Answered from your material|Enhanced with trusted web sources|Enhanced with web sources/)
})

test('learning chat renders confidence-aware source cues', () => {
  const source = fs.readFileSync(new URL('../pages/learning-chat.jsx', import.meta.url), 'utf8')
  assert.match(source, /confidenceReason|confidence_reason/)
  assert.match(source, /sourceBadge|source_badge/)
})

test('learning chat uses QuickCheckCard for adaptive checks', () => {
  const source = fs.readFileSync(new URL('../pages/learning-chat.jsx', import.meta.url), 'utf8')
  assert.match(source, /QuickCheckCard/)
})
