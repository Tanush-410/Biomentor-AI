import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("student dashboard references study coach overview endpoint", () => {
  const source = fs.readFileSync("frontend/pages/dashboard.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/overview/);
  assert.match(source, /StudyCoachPanel/);
  assert.match(source, /Next best move/);
  assert.match(source, /confidence_reason|confidenceReason/);
});

test("progress page references study coach progress endpoint", () => {
  const source = fs.readFileSync("frontend/pages/progress.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/progress/);
  assert.match(source, /Practice guidance/);
});

test("materials page references study coach materials endpoint", () => {
  const source = fs.readFileSync("frontend/pages/documents.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/materials/);
  assert.match(source, /What to open next/);
});

test("learning chat references study coach chat suggestions endpoint", () => {
  const source = fs.readFileSync("frontend/pages/learning-chat.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/chat-suggestions/);
  assert.match(source, /Chat follow-up guidance/);
});
