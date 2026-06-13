import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('anticheat bot focuses the educator on final cases and last-three evidence review', () => {
  const source = fs.readFileSync(new URL('../pages/educator/anticheat-bot.jsx', import.meta.url), 'utf8')

  assert.match(source, /Anticheat Bot/)
  assert.match(source, /Final debarred cases/i)
  assert.match(source, /Teacher review required/i)
  assert.match(source, /Last three evidence snapshots/i)
  assert.match(source, /Case decision summary/i)
  assert.match(source, /Open grading desk|Review grading desk/i)
})
