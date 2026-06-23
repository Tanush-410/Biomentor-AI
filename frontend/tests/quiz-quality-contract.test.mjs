import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readFromRepo(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("quiz maker references quiz quality review endpoint and panel", () => {
  const source = readFromRepo("pages", "educator", "quiz-maker.jsx");
  assert.match(source, /QuizQualityPanel/);
  assert.match(source, /\/educator\/quiz-quality\/review/);
  assert.match(source, /handleReview/);
});

test("quiz quality panel renders score, issues, and suggestions", () => {
  const source = readFromRepo("components", "QuizQualityPanel.jsx");
  assert.match(source, /AI Quiz Quality Layer/);
  assert.match(source, /Release readiness/);
  assert.match(source, /Assessment command/);
  assert.match(source, /Release risk/);
  assert.match(source, /Fix first/);
  assert.match(source, /Question health/);
  assert.match(source, /Remediation plan/);
  assert.match(source, /Issues to fix/);
  assert.match(source, /Suggested improvements/);
  assert.match(source, /confidence_reason|confidenceReason/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1\.2fr\)_minmax\(0,0\.8fr\)\]/);
});
