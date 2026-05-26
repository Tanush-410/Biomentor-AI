import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('classroom join flow normalizes invite codes and redirects into the joined classroom', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/index.jsx', import.meta.url), 'utf8')
  assert.match(source, /joinCode\.trim\(\)\.toUpperCase\(\)/)
  assert.match(source, /router\.push\(`\/classrooms\/\$\{payload\.classroom_id\}\/stream`\)/)
})
