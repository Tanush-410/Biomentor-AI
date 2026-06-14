import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("MeetingAssistantPanel renders the expected sections", () => {
  const source = fs.readFileSync("frontend/components/MeetingAssistantPanel.jsx", "utf8");
  assert.match(source, /Live Notes/);
  assert.match(source, /Action Items/);
  assert.match(source, /Unanswered Doubts/);
  assert.match(source, /Suggested Follow-up/);
  assert.match(source, /confidenceReason|confidence_reason/);
});

test("VideoMeetingRoom references transcript client and assistant APIs", () => {
  const source = fs.readFileSync("frontend/components/VideoMeetingRoom.jsx", "utf8");
  assert.match(source, /createMeetingTranscriptClient/);
  assert.match(source, /MeetingAssistantPanel/);
  assert.match(source, /postMeetingTranscript/);
  assert.match(source, /getMeetingAssistantSnapshot/);
});

test("classroom live page renders post-meeting recap content", () => {
  const source = fs.readFileSync("frontend/pages/classrooms/[id]/live.jsx", "utf8");
  assert.match(source, /Meeting recap/);
  assert.match(source, /getMeetingRecap/);
});
