# Platform Stability And Assessment Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the hosted materials and live-meeting blockers, then upgrade exam grading, anti-cheat evidence quality, and the educator exam authoring experience so the app matches the promised product behavior.

**Architecture:** Execute this as three linked tracks. First stabilize hosted document access and meeting media/transcript behavior in the current FastAPI + Next.js architecture. Next strengthen grading and anti-cheat by improving scoring/evidence services without changing the core classroom route model. Finally polish the educator authoring and review UI on top of those reliable backend and runtime paths.

**Tech Stack:** FastAPI, SQLAlchemy, Next.js 14 pages router, React 18, browser WebRTC, browser MediaDevices / Canvas capture, existing VYDRA CORE classroom APIs, Python unittest, Node test runner

---

## File Structure

### Backend files to modify
- `backend/app/main.py`
  - CORS and hosted access hardening
- `backend/app/routers/documents.py`
  - shared material visibility, hosted loading, upload/view rules
- `backend/app/routers/classrooms.py`
  - exam runtime APIs, anti-cheat capture handling, meeting transcript/media reliability touchpoints
- `backend/app/services/meeting_assistant.py`
  - transcript normalization, MIME-aware audio ingestion, summary quality improvements
- `backend/app/services/exam_grading.py`
  - rubric-oriented descriptive grading and image-answer teacher-review posture
- `backend/app/services/exam_review.py`
  - richer teacher review payloads
- `backend/app/services/anticheat_bot.py`
  - stronger case/evidence summarization
- `backend/app/services/proctor_review.py`
  - stronger educator-facing anti-cheat reasoning if needed

### Frontend files to modify
- `frontend/pages/documents.jsx`
  - hosted upload/list reliability and better surfaced errors
- `frontend/pages/document/[id].jsx`
  - hosted PDF/file loading reliability
- `frontend/pages/classrooms/[id]/live.jsx`
  - live meeting entry and teacher/student reliability messaging if needed
- `frontend/pages/classrooms/[id]/live/[meetingId]/room.jsx`
  - meeting room reliability and teacher assistant flow if needed
- `frontend/components/VideoMeetingRoom.jsx`
  - remote media playback, transcript capture lifecycle, teacher AI panel stability
- `frontend/hooks/useWebRTCMeeting.js`
  - deterministic peer bootstrap and signaling resilience
- `frontend/lib/classroomApi.js`
  - correct hosted API/audio upload behavior
- `frontend/lib/meetingAudioTranscriber.js`
  - better chunking and fallback behavior
- `frontend/pages/educator/exam-maker.jsx`
  - richer document-style authoring controls
- `frontend/pages/educator/exam-review/[examId].jsx`
  - better teacher review flow and release workflow polish
- `frontend/pages/classrooms/[id]/exam/[examId].jsx`
  - smarter exam runtime feedback, answer capture, and evidence flow
- `frontend/pages/classrooms/[id]/quiz/[quizId].jsx`
  - shared anti-cheat evidence behavior and messaging consistency

### Tests to modify or add
- `backend/tests/test_document_material_access.py`
- `backend/tests/test_ai_meeting_assistant.py`
- `backend/tests/test_classroom_live_meetings.py`
- `backend/tests/test_exam_grading.py`
- `backend/tests/test_exam_review.py`
- `backend/tests/test_ai_proctor_review.py`
- `frontend/tests/meeting-room-reliability-contract.test.mjs`
- `frontend/tests/classroom-live-contract.test.mjs`
- `frontend/tests/classroom-quiz-evidence-contract.test.mjs`
- `frontend/tests/exam-maker-contract.test.mjs`
- `frontend/tests/exam-review-surface-contract.test.mjs`
- `frontend/tests/anticheat-bot-contract.test.mjs`

### New documentation
- Update `README.md` after implementation if any runtime/env/deployment behavior changes

---

### Task 1: Stabilize Hosted Material Uploading, Listing, And Viewing

**Files:**
- Modify: `backend/app/routers/documents.py`
- Modify: `backend/app/main.py`
- Modify: `frontend/pages/documents.jsx`
- Modify: `frontend/pages/document/[id].jsx`
- Test: `backend/tests/test_document_material_access.py`

- [ ] **Step 1: Write the failing backend material access tests**

```python
def test_student_document_library_includes_classroom_shared_materials(self):
    payload = list_accessible_documents_for_user(self.db, self.student)
    ids = [item.id for item in payload]
    self.assertIn(self.shared_document.id, ids)

def test_shared_document_ai_routes_use_owner_context(self):
    response = self.client.get(
        f"/api/documents/{self.shared_document.id}/material-intelligence",
        headers=self.student_headers,
    )
    self.assertNotEqual(response.status_code, 404)
```

- [ ] **Step 2: Run backend material tests to verify the existing failure mode**

Run: `python3 -m unittest backend.tests.test_document_material_access -v`
Expected: failing assertions around shared visibility or owner-context behavior

- [ ] **Step 3: Implement the minimal backend fixes**

```python
def list_documents(...):
    return list_accessible_documents_for_user(db, current_user)

def get_document(...):
    document = get_accessible_document_for_user(db, document_id, current_user)

document_owner_id = document.user_id
document_context = get_document_context(db, document_id, document_owner_id)
```

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    ...
)
```

- [ ] **Step 4: Add frontend hosted fallback behavior**

```javascript
async function fetchBackendEndpoint(path, options = {}) {
  const direct = await tryFetch(directBackendApi(path), options)
  if (direct.ok) return direct
  return fetch(proxiedBackendApi(path), options)
}
```

```javascript
const response = await fetchBackendEndpoint('/study-coach/materials', {
  headers: { Authorization: `Bearer ${token}` }
})
```

- [ ] **Step 5: Re-run the targeted material tests**

Run: `python3 -m unittest backend.tests.test_document_material_access -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/app/routers/documents.py frontend/pages/documents.jsx frontend/pages/document/[id].jsx backend/tests/test_document_material_access.py
git commit -m "fix: stabilize hosted material access and viewing"
```

---

### Task 2: Make Live Meeting Audio/Video Joins Reliable

**Files:**
- Modify: `frontend/hooks/useWebRTCMeeting.js`
- Modify: `frontend/components/VideoMeetingRoom.jsx`
- Modify: `frontend/tests/meeting-room-reliability-contract.test.mjs`
- Test: `frontend/tests/classroom-live-contract.test.mjs`

- [ ] **Step 1: Write the failing meeting reliability contract coverage**

```javascript
test('meeting hook bootstraps peer connections from meeting_state and sends deterministic offers', () => {
  const source = fs.readFileSync(new URL('../hooks/useWebRTCMeeting.js', import.meta.url), 'utf8')
  assert.match(source, /meeting_state/)
  assert.match(source, /shouldInitiateOffer/)
  assert.match(source, /createAndSendOffer|startPeerConnection/)
})
```

- [ ] **Step 2: Run frontend meeting reliability tests**

Run: `cd frontend && node --test tests/meeting-room-reliability-contract.test.mjs tests/classroom-live-contract.test.mjs`
Expected: FAIL if deterministic bootstrap logic is incomplete

- [ ] **Step 3: Implement deterministic peer bootstrap**

```javascript
const shouldInitiateOffer = (targetUserId) => String(user.id) < String(targetUserId)

const syncParticipantConnection = async (participant) => {
  await ensurePeerConnection(participant.user_id)
  if (shouldInitiateOffer(participant.user_id)) {
    await createAndSendOffer(participant.user_id)
  }
}
```

```javascript
case 'meeting_state':
  setParticipants(nextParticipants)
  nextParticipants.forEach((participant) => {
    void syncParticipantConnection(participant)
  })
```

- [ ] **Step 4: Harden remote media playback**

```javascript
videoElement.srcObject = stream
videoElement.muted = muted
try {
  await videoElement.play()
} catch {
  videoElement.muted = true
  await videoElement.play()
  videoElement.muted = muted
}
```

- [ ] **Step 5: Re-run meeting tests**

Run: `cd frontend && node --test tests/meeting-room-reliability-contract.test.mjs tests/classroom-live-contract.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/hooks/useWebRTCMeeting.js frontend/components/VideoMeetingRoom.jsx frontend/tests/meeting-room-reliability-contract.test.mjs frontend/tests/classroom-live-contract.test.mjs
git commit -m "fix: improve classroom meeting media reliability"
```

---

### Task 3: Improve Meeting Transcript Accuracy And Assistant Input Quality

**Files:**
- Modify: `backend/app/services/meeting_assistant.py`
- Modify: `backend/app/routers/classrooms.py`
- Modify: `frontend/lib/classroomApi.js`
- Modify: `frontend/lib/meetingAudioTranscriber.js`
- Modify: `backend/tests/test_ai_meeting_assistant.py`

- [ ] **Step 1: Write the failing transcript-ingestion tests**

```python
def test_transcribe_meeting_audio_uses_uploaded_content_type(self):
    result = transcribe_meeting_audio_blob(
        b"bytes",
        filename="meeting.mp4",
        content_type="audio/mp4",
    )
    self.assertIsNotNone(result)

def test_persist_meeting_transcript_rejects_tiny_duplicate_noise(self):
    with self.assertRaises(ValueError):
        persist_meeting_transcript(..., content="ok")
```

- [ ] **Step 2: Run transcript tests**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant -v`
Expected: FAIL on MIME handling or transcript noise behavior

- [ ] **Step 3: Implement MIME-aware upload and normalization**

```python
def transcribe_meeting_audio_blob(audio_bytes, filename, content_type=None):
    mime_type = content_type or "audio/webm"
    audio_file = (filename, audio_bytes, mime_type)
```

```python
content = normalize_meeting_transcript_content(content)
if len(content.split()) < 2:
    raise ValueError("Transcript snippet is too short.")
```

```javascript
function inferAudioExtension(mimeType) {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('mpeg')) return 'mp3'
  return 'webm'
}
```

- [ ] **Step 4: Re-run transcript tests**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/meeting_assistant.py backend/app/routers/classrooms.py frontend/lib/classroomApi.js frontend/lib/meetingAudioTranscriber.js backend/tests/test_ai_meeting_assistant.py
git commit -m "fix: improve meeting transcript ingestion quality"
```

---

### Task 4: Strengthen Quiz And Exam Anti-Cheat Evidence Quality

**Files:**
- Modify: `frontend/pages/classrooms/[id]/quiz/[quizId].jsx`
- Modify: `frontend/pages/classrooms/[id]/exam/[examId].jsx`
- Modify: `backend/app/routers/classrooms.py`
- Modify: `backend/app/services/anticheat_bot.py`
- Modify: `backend/app/services/proctor_review.py`
- Test: `frontend/tests/classroom-quiz-evidence-contract.test.mjs`
- Test: `backend/tests/test_ai_proctor_review.py`

- [ ] **Step 1: Write the failing anti-cheat evidence tests**

```javascript
test('classroom quiz proctoring captures evidence snapshots for warnings and violations', () => {
  assert.match(source, /captureEvidenceSnapshot/)
  assert.match(source, /evidence_image_data_url/)
})
```

```python
def test_anticheat_payload_highlights_final_reason_and_recent_evidence(self):
    payload = build_anticheat_case_payload(case, evidence_rows)
    self.assertEqual(len(payload["evidence_snapshots"]), 3)
    self.assertIn("final_case_reason", payload)
```

- [ ] **Step 2: Run anti-cheat tests**

Run: `python3 -m unittest backend.tests.test_ai_proctor_review -v`
Run: `cd frontend && node --test tests/classroom-quiz-evidence-contract.test.mjs tests/anticheat-bot-contract.test.mjs`
Expected: FAIL if evidence summary or quiz wiring is incomplete

- [ ] **Step 3: Implement stronger evidence packaging**

```python
return {
    "id": case.get("id"),
    "final_case_reason": case.get("final_case_reason"),
    "status": case.get("status") or "teacher_review_required",
    "evidence_snapshots": [serialize_anticheat_evidence(row) for row in ordered[:3]],
}
```

```javascript
const warningMessages = {
  ai_multiple_faces: 'AI warning: more than one face was detected in the frame.',
  ai_face_missing: 'AI warning: your face is not clearly visible to the camera.',
  ai_looking_down: 'AI warning: possible off-screen or phone glance detected.'
}
```

- [ ] **Step 4: Re-run anti-cheat tests**

Run: `python3 -m unittest backend.tests.test_ai_proctor_review -v`
Run: `cd frontend && node --test tests/classroom-quiz-evidence-contract.test.mjs tests/anticheat-bot-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/classrooms/[id]/quiz/[quizId].jsx frontend/pages/classrooms/[id]/exam/[examId].jsx backend/app/routers/classrooms.py backend/app/services/anticheat_bot.py backend/app/services/proctor_review.py backend/tests/test_ai_proctor_review.py frontend/tests/classroom-quiz-evidence-contract.test.mjs frontend/tests/anticheat-bot-contract.test.mjs
git commit -m "feat: strengthen assessment anti-cheat evidence handling"
```

---

### Task 5: Upgrade Descriptive Exam Grading And Teacher Review Quality

**Files:**
- Modify: `backend/app/services/exam_grading.py`
- Modify: `backend/app/services/exam_review.py`
- Modify: `frontend/pages/educator/exam-review/[examId].jsx`
- Modify: `backend/tests/test_exam_grading.py`
- Modify: `backend/tests/test_exam_review.py`
- Modify: `frontend/tests/exam-review-surface-contract.test.mjs`

- [ ] **Step 1: Write the failing grading tests**

```python
def test_exam_grading_flags_image_only_answers_for_teacher_review(self):
    payload = build_exam_grading_payload(...)
    self.assertTrue(payload["teacher_review_required"])
    self.assertIn("image_only_response_requires_teacher_review", payload["low_confidence_reasons"])

def test_exam_grading_uses_keyword_coverage_and_answer_length_signals(self):
    payload = build_exam_grading_payload(...)
    self.assertIn("confidence", payload["question_breakdown"][0])
```

- [ ] **Step 2: Run exam grading tests**

Run: `python3 -m unittest backend.tests.test_exam_grading backend.tests.test_exam_review -v`
Expected: FAIL where rubric-oriented output is still too weak

- [ ] **Step 3: Implement stronger descriptive grading heuristics**

```python
coverage = len(hits) / max(len(keywords), 1)
length_signal = min(len(answer_text.split()) / 80, 1.0)
structure_signal = 1.0 if answer_text.count(".") >= 2 else 0.6
score_ratio = (coverage * 0.65) + (length_signal * 0.2) + (structure_signal * 0.15)
score = round(marks * min(score_ratio, 1.0), 2)
```

```python
if image_urls and not answer_text:
    review_reasons.append("image_only_response_requires_teacher_review")
    confidence = min(confidence, 0.3)
```

- [ ] **Step 4: Improve teacher review desk copy and release cues**

```javascript
<Metric label="Release reviewed score" value={`${releaseScore}`} />
<Metric label="Next student requiring review" value={nextReviewAttempt?.student_name || 'Queue complete'} />
```

- [ ] **Step 5: Re-run exam grading and review tests**

Run: `python3 -m unittest backend.tests.test_exam_grading backend.tests.test_exam_review -v`
Run: `cd frontend && node --test tests/exam-review-surface-contract.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/exam_grading.py backend/app/services/exam_review.py frontend/pages/educator/exam-review/[examId].jsx backend/tests/test_exam_grading.py backend/tests/test_exam_review.py frontend/tests/exam-review-surface-contract.test.mjs
git commit -m "feat: improve descriptive exam grading and review"
```

---

### Task 6: Polish The Exam Maker Into A More Document-Like Composer

**Files:**
- Modify: `frontend/pages/educator/exam-maker.jsx`
- Modify: `frontend/tests/exam-maker-contract.test.mjs`

- [ ] **Step 1: Write the failing exam-maker contract**

```javascript
test('exam maker exposes richer mini-word editor controls', () => {
  assert.match(source, /Drag to reorder/i)
  assert.match(source, /Upload diagram|Upload image/i)
  assert.match(source, /Image caption/i)
  assert.match(source, /Page break before block/i)
  assert.match(source, /Answer box preview/i)
})
```

- [ ] **Step 2: Run exam-maker contract test**

Run: `cd frontend && node --test tests/exam-maker-contract.test.mjs`
Expected: FAIL if the richer editor controls are missing

- [ ] **Step 3: Implement the document-style polish**

```javascript
<div draggable onDragStart={() => setDraggedBlockId(block.local_id)} ...>
  <div className="rounded-2xl border border-dashed ...">Drag to reorder</div>
</div>
```

```javascript
<input type="file" accept="image/*" onChange={(event) => handleBlockImageUpload(block.local_id, event.target.files?.[0] || null)} />
<input value={block.content.caption || ''} ... placeholder="Figure 2. Label the nucleus and mitochondria." />
```

```javascript
<label className="flex items-center gap-3 ...">
  <input type="checkbox" checked={Boolean(block.content?.layout?.page_break_before)} ... />
</label>
```

- [ ] **Step 4: Re-run exam-maker contract**

Run: `cd frontend && node --test tests/exam-maker-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/educator/exam-maker.jsx frontend/tests/exam-maker-contract.test.mjs
git commit -m "feat: polish educator exam maker composer"
```

---

### Task 7: Run Final Verification Across The Upgraded Tracks

**Files:**
- Verify only

- [ ] **Step 1: Run backend verification**

Run: `python3 -m unittest backend.tests.test_document_material_access backend.tests.test_ai_meeting_assistant backend.tests.test_exam_grading backend.tests.test_exam_review backend.tests.test_ai_proctor_review backend.tests.test_classroom_exams -v`
Expected: PASS

- [ ] **Step 2: Run frontend verification**

Run: `cd frontend && node --test tests/meeting-room-reliability-contract.test.mjs tests/classroom-live-contract.test.mjs tests/classroom-quiz-evidence-contract.test.mjs tests/exam-maker-contract.test.mjs tests/exam-review-surface-contract.test.mjs tests/anticheat-bot-contract.test.mjs`
Expected: PASS

- [ ] **Step 3: Capture any hosted-only residual risks**

```text
- TURN is still required for hostile NATs in real multi-network meeting calls.
- Hosted material upload/view still depends on correct production env wiring.
- Vision-grade anti-cheat inference is still browser-heuristic, not cloud-vision based.
```

- [ ] **Step 4: Commit final verification-only adjustments if needed**

```bash
git add .
git commit -m "chore: verify platform stability and assessment upgrades"
```
