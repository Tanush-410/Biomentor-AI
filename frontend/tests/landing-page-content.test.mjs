import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('landing page contains the refreshed product positioning hooks', () => {
  const source = fs.readFileSync(new URL('../pages/index.jsx', import.meta.url), 'utf8')

  assert.match(source, /const heroWords = \['Smarter', 'Learning', 'Starts', 'Here\.'\]/)
  assert.match(source, /study from your own material/i)
  assert.match(source, /classroom-ready/i)
  assert.match(source, /proctored/i)
})
