import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const readFromRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("MeetingAssistantPanel renders the expected sections", () => {
  const source = readFromRepo("components/MeetingAssistantPanel.jsx");
  assert.match(source, /Live Notes/);
  assert.match(source, /Concept Signals/);
  assert.match(source, /Action Items/);
  assert.match(source, /Teacher Moves/);
  assert.match(source, /Student Risk Flags/);
  assert.match(source, /Unanswered Doubts/);
  assert.match(source, /Follow-up Assets/);
  assert.match(source, /confidenceReason|confidence_reason/);
});

test("VideoMeetingRoom references transcript client and assistant APIs", () => {
  const source = readFromRepo("components/VideoMeetingRoom.jsx");
  assert.match(source, /createMeetingTranscriptClient/);
  assert.match(source, /MeetingAssistantPanel/);
  assert.match(source, /postMeetingTranscript/);
  assert.match(source, /getMeetingAssistantSnapshot/);
  assert.match(source, /teacher copilot|Teacher Copilot|Meeting Copilot/);
});

test("classroom live page renders post-meeting recap content", () => {
  const source = readFromRepo("pages/classrooms/[id]/live.jsx");
  assert.match(source, /Meeting recap/);
  assert.match(source, /Study recap/);
  assert.match(source, /Next class moves/);
  assert.match(source, /getMeetingRecap/);
});
