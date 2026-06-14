import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('classroom live page uses meeting scheduler and meeting list', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/live.jsx', import.meta.url), 'utf8')
  assert.match(source, /MeetingScheduler/)
  assert.match(source, /MeetingList/)
})

test('meeting list joins the dedicated room route', () => {
  const source = fs.readFileSync(new URL('../components/MeetingList.jsx', import.meta.url), 'utf8')
  assert.match(source, /\/live\/\$\{meeting\.id\}\/room/)
})

test('meeting room page renders VideoMeetingRoom in the dedicated room route', () => {
  const source = fs.readFileSync(new URL('../pages/classrooms/[id]/live/[meetingId]/room.jsx', import.meta.url), 'utf8')
  assert.match(source, /VideoMeetingRoom/)
  assert.doesNotMatch(source, /ClassroomShell/)
})
