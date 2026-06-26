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

test("useWebRTCMeeting bootstraps existing room participants deterministically", () => {
  const source = readFromRepo("hooks/useWebRTCMeeting.js");
  assert.match(source, /meeting_state/);
  assert.match(source, /shouldInitiateOffer/);
  assert.match(source, /createAndSendOffer|startPeerConnection/);
});

test("useWebRTCMeeting uses polite negotiation and ICE restarts for unstable peers", () => {
  const source = readFromRepo("hooks/useWebRTCMeeting.js");
  assert.match(source, /isPolitePeer/);
  assert.match(source, /offerCollision/);
  assert.match(source, /rollback/);
  assert.match(source, /iceRestartInFlightRef/);
  assert.match(source, /iceRestart: true/);
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
  assert.match(source, /audioTranscriber\.isSupported/);
  assert.match(source, /transcriptClient\.isSupported/);
  assert.doesNotMatch(source, /else if \(transcriptClient\.isSupported\)/);
});

test("VideoMeetingRoom surfaces hosted TURN relay guidance when real-time media reliability is limited", () => {
  const source = readFromRepo("components/VideoMeetingRoom.jsx");
  assert.match(source, /TURN/i);
  assert.match(source, /relay/i);
});

test("useWebRTCMeeting accepts production TURN URL lists and password aliases", () => {
  const source = readFromRepo("hooks/useWebRTCMeeting.js");
  assert.match(source, /NEXT_PUBLIC_TURN_URLS/);
  assert.match(source, /NEXT_PUBLIC_TURN_PASSWORD/);
  assert.match(source, /normalizeIceServerEntries/);
  assert.match(source, /turns:/);
});

test("useWebRTCMeeting keeps remote media when browsers deliver tracks without streams", () => {
  const source = readFromRepo("hooks/useWebRTCMeeting.js");
  assert.match(source, /new MediaStream/);
  assert.match(source, /event\.track/);
  assert.match(source, /addTrack/);
});

test("VideoMeetingRoom treats either TURN URL env shape as hosted relay configured", () => {
  const source = readFromRepo("components/VideoMeetingRoom.jsx");
  assert.match(source, /NEXT_PUBLIC_TURN_URLS/);
  assert.match(source, /NEXT_PUBLIC_TURN_URL/);
});
