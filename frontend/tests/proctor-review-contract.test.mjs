import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readFromRepo(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("classroom quiz educator view wires the proctor review endpoint and panel", () => {
  const source = readFromRepo("pages", "classrooms", "[id]", "quiz", "[quizId].jsx");
  assert.match(source, /getClassroomQuizProctorReview/);
  assert.match(source, /ProctorReviewPanel/);
  assert.match(source, /AI Proctor Review/);
});

test("student analytics page renders proctor review guidance", () => {
  const source = readFromRepo("pages", "educator", "student", "[id].jsx");
  assert.match(source, /ProctorReviewPanel/);
  assert.match(source, /analytics\?\.proctoring_review/);
});

test("shared proctor review panel exposes timeline and recommendations", () => {
  const source = readFromRepo("components", "ProctorReviewPanel.jsx");
  assert.match(source, /Case posture/);
  assert.match(source, /Evidence strength/);
  assert.match(source, /Review priority/);
  assert.match(source, /Debar review/);
  assert.match(source, /Follow-up actions/);
  assert.match(source, /Educator recommendations/);
  assert.match(source, /Recent timeline/);
  assert.match(source, /Student incident snapshots/);
  assert.match(source, /confidence_reason|confidenceReason/);
});
