import test from 'node:test'
import assert from 'node:assert/strict'

import { getClassroomBasePath, normalizeClassroomId, shouldApplyClassroomResponse } from './classroomRouteState.js'

test('normalizeClassroomId prefers the route id while classroom data is still loading', () => {
  assert.equal(normalizeClassroomId('room-123', null), 'room-123')
})

test('getClassroomBasePath builds tab links from the route id immediately', () => {
  assert.equal(getClassroomBasePath('room-123', null), '/classrooms/room-123')
})

test('shouldApplyClassroomResponse blocks stale responses from older classroom requests', () => {
  assert.equal(shouldApplyClassroomResponse('new-room', 'old-room'), false)
  assert.equal(shouldApplyClassroomResponse('room-123', 'room-123'), true)
})
