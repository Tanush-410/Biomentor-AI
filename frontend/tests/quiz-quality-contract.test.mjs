import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("quiz maker references quiz quality review endpoint and panel", () => {
  const source = fs.readFileSync("frontend/pages/educator/quiz-maker.jsx", "utf8");
  assert.match(source, /QuizQualityPanel/);
  assert.match(source, /\/api\/educator\/quiz-quality\/review/);
  assert.match(source, /handleReview/);
});

test("quiz quality panel renders score, issues, and suggestions", () => {
  const source = fs.readFileSync("frontend/components/QuizQualityPanel.jsx", "utf8");
  assert.match(source, /AI Quiz Quality Layer/);
  assert.match(source, /Release readiness/);
  assert.match(source, /Issues to fix/);
  assert.match(source, /Suggested improvements/);
  assert.match(source, /confidence_reason|confidenceReason/);
});
