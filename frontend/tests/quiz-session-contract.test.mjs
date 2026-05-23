import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('quiz session defines answeredCount before using it in progress UI', () => {
  const source = fs.readFileSync(new URL('../pages/quiz-session.jsx', import.meta.url), 'utf8')

  assert.match(source, /const answeredCount = Object\.keys\(answers\)\.length/)
  assert.match(source, /caption=\{`\$\{answeredCount\} answered`\}/)
})
