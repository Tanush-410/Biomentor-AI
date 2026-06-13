import { directBackendApi, fetchBackendWithFallback } from './backendApi'

function inferAudioExtension(mimeType = '') {
  if (mimeType.includes('mp4')) return '.mp4'
  if (mimeType.includes('ogg')) return '.ogg'
  if (mimeType.includes('mpeg')) return '.mp3'
  return '.webm'
}

async function classroomRequest(path, token, options = {}) {
  const response = await fetchBackendWithFallback(path.replace(/^\/api/, ''), {
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

export function listClassroomCertifications(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications`, token)
}

export function getClassroomCertification(token, classroomId, certificationId) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}`, token)
}

export function createClassroomCertification(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function draftClassroomCertification(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/draft`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateClassroomCertification(token, classroomId, certificationId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}

export function publishClassroomCertification(token, classroomId, certificationId) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}/publish`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function getClassroomCertificationRoster(token, classroomId, certificationId) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}/roster`, token)
}

export function getMyClassroomCertification(token, classroomId, certificationId) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}/me`, token)
}

export function completeClassroomCertificationStep(token, classroomId, certificationId, stepId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}/steps/${stepId}/complete`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function submitClassroomCertificationProof(token, classroomId, certificationId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}/proof`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function overrideClassroomCertificationStep(token, classroomId, certificationId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}/override-step`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function issueClassroomCertificate(token, classroomId, certificationId, studentId) {
  return classroomRequest(`/api/classrooms/${classroomId}/certifications/${certificationId}/issue/${studentId}`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function getMyCertificates(token) {
  return classroomRequest('/api/certificates/me', token)
}

export function getCertificate(token, certificateId) {
  return classroomRequest(`/api/certificates/${certificateId}`, token)
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

export function listClassroomExams(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams`, token)
}

export function getClassroomExam(token, classroomId, examId) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}`, token)
}

export function getClassroomExamReviewWorkspace(token, classroomId, examId) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/review`, token)
}

export function getClassroomExamReviewAttempt(token, classroomId, examId, attemptId) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/review/${attemptId}`, token)
}

export function submitClassroomExamReview(token, classroomId, examId, attemptId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/review/${attemptId}`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function createClassroomExam(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function createClassroomExamDraft(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/draft`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function startClassroomExamAttempt(token, classroomId, examId) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/start`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function submitClassroomExamAttempt(token, classroomId, examId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/submit`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function reportClassroomExamWarning(token, classroomId, examId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/warning`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function reportClassroomExamViolation(token, classroomId, examId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/violation`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function heartbeatClassroomExamAttempt(token, classroomId, examId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/exams/${examId}/heartbeat`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getAnticheatBotCases(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/anticheat-bot`, token)
}

export function getAnticheatBotCaseDetail(token, classroomId, caseId) {
  return classroomRequest(`/api/classrooms/${classroomId}/anticheat-bot/${caseId}`, token)
}

export function upholdAnticheatBotCase(token, classroomId, caseId) {
  return classroomRequest(`/api/classrooms/${classroomId}/anticheat-bot/${caseId}/uphold`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function excuseAnticheatBotCase(token, classroomId, caseId) {
  return classroomRequest(`/api/classrooms/${classroomId}/anticheat-bot/${caseId}/excuse`, token, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function reopenAnticheatBotCase(token, classroomId, caseId) {
  return classroomRequest(`/api/classrooms/${classroomId}/anticheat-bot/${caseId}/reopen`, token, {
    method: 'POST',
    body: JSON.stringify({})
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

export async function postMeetingAudioTranscript(token, classroomId, meetingId, audioBlob) {
  const formData = new FormData()
  formData.append('audio', audioBlob, `meeting-${meetingId}${inferAudioExtension(audioBlob?.type || '')}`)

  const response = await fetchBackendWithFallback(`/classrooms/${classroomId}/meetings/${meetingId}/transcriptions/audio`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || 'Request failed')
  }
  return payload
}

export function getConfiguredApiBase() {
  return (directBackendApi('') || '').replace(/\/api$/, '')
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
