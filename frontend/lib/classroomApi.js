const API_BASE = process.env.NEXT_PUBLIC_API_URL

async function classroomRequest(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || 'Request failed')
  }
  return payload
}

export function listClassrooms(token) {
  return classroomRequest('/api/classrooms', token)
}

export function getClassroom(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}`, token)
}

export function getClassroomIntelligence(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/intelligence`, token)
}

export function getClassroomStream(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/stream`, token)
}

export function createClassroomAnnouncement(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/announcements`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getClasswork(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/classwork`, token)
}

export function shareClassroomMaterial(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/materials`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function createClassroomAssignment(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/assignments`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function listClassroomQuizzes(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes`, token)
}

export function getClassroomQuiz(token, classroomId, quizId) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes/${quizId}`, token)
}

export function getClassroomQuizProctorReview(token, classroomId, quizId) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes/${quizId}/proctor-review`, token)
}

export function createClassroomQuiz(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function startClassroomQuizAttempt(token, classroomId, quizId) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes/${quizId}/start`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function submitClassroomQuizAttempt(token, classroomId, quizId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes/${quizId}/submit`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function reportClassroomQuizViolation(token, classroomId, quizId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes/${quizId}/violation`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function reportClassroomQuizWarning(token, classroomId, quizId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes/${quizId}/warning`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function heartbeatClassroomQuizAttempt(token, classroomId, quizId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/quizzes/${quizId}/heartbeat`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getClassroomPeople(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/people`, token)
}

export function listClassroomThreads(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/messages/threads`, token)
}

export function createClassroomThread(token, classroomId, payload = {}) {
  return classroomRequest(`/api/classrooms/${classroomId}/messages/threads`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getClassroomThread(token, classroomId, threadId) {
  return classroomRequest(`/api/classrooms/${classroomId}/messages/threads/${threadId}`, token)
}

export function postClassroomThreadMessage(token, classroomId, threadId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/messages/threads/${threadId}/messages`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getClassroomLive(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/live`, token)
}

export function listClassroomMeetings(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings`, token)
}

export function createClassroomMeeting(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getClassroomMeeting(token, classroomId, meetingId) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}`, token)
}

export function startClassroomMeeting(token, classroomId, meetingId) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/start`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function endClassroomMeeting(token, classroomId, meetingId) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/end`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function postMeetingTranscript(token, classroomId, meetingId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/transcripts`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function postMeetingEvent(token, classroomId, meetingId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/events`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getMeetingAssistantSnapshot(token, classroomId, meetingId) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/assistant`, token)
}

export function getMeetingRecap(token, classroomId, meetingId) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/recap`, token)
}

export function scheduleClassroomLive(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/live/schedule`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function startClassroomLive(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/live/start`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function listNotifications(token) {
  return classroomRequest('/api/classrooms/notifications', token)
}

export function markNotificationRead(token, notificationId) {
  return classroomRequest(`/api/classrooms/notifications/${notificationId}/read`, token, {
    method: 'POST'
  })
}

export function joinClassroom(token, inviteCode) {
  return classroomRequest('/api/classrooms/join', token, {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode })
  })
}

export function createEducatorClassroom(token, payload) {
  return classroomRequest('/api/educator/classrooms', token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function listDocuments(token) {
  return classroomRequest('/api/documents/', token)
}
