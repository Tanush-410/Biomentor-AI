import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("classroom quiz educator view wires the proctor review endpoint and panel", () => {
  const source = fs.readFileSync("frontend/pages/classrooms/[id]/quiz/[quizId].jsx", "utf8");
  assert.match(source, /getClassroomQuizProctorReview/);
  assert.match(source, /ProctorReviewPanel/);
  assert.match(source, /AI Proctor Review/);
});

test("student analytics page renders proctor review guidance", () => {
  const source = fs.readFileSync("frontend/pages/educator/student/[id].jsx", "utf8");
  assert.match(source, /ProctorReviewPanel/);
  assert.match(source, /analytics\?\.proctoring_review/);
});

test("shared proctor review panel exposes timeline and recommendations", () => {
  const source = fs.readFileSync("frontend/components/ProctorReviewPanel.jsx", "utf8");
  assert.match(source, /Educator recommendations/);
  assert.match(source, /Recent timeline/);
  assert.match(source, /Student incident snapshots/);
  assert.match(source, /confidence_reason|confidenceReason/);
});
