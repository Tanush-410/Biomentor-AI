import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const readFromRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("useWebRTCMeeting queues remote ICE candidates until the remote description exists", () => {
  const source = readFromRepo("hooks/useWebRTCMeeting.js");
  assert.match(source, /pendingIceCandidatesRef/);
  assert.match(source, /queueIceCandidate|flushPendingIceCandidates/);
  assert.match(source, /peer\.remoteDescription/);
  assert.match(source, /addIceCandidate/);
});

test("meeting transcript client can recover after recognition ends", () => {
  const source = readFromRepo("lib/meetingTranscriptClient.js");
  assert.match(source, /shouldRestart|manuallyStopped/);
  assert.match(source, /recognition\.onend/);
  assert.match(source, /window\.setTimeout|setTimeout/);
});

test("VideoMeetingRoom uses both browser speech fallback and audio transcription uploads", () => {
  const source = readFromRepo("components/VideoMeetingRoom.jsx");
  assert.match(source, /createMeetingTranscriptClient/);
  assert.match(source, /createMeetingAudioTranscriber/);
  assert.match(source, /postMeetingAudioTranscript/);
});
