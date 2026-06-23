import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("student dashboard references study coach overview endpoint", () => {
  const source = read("pages/dashboard.jsx");
  assert.match(source, /\/study-coach\/overview/);
  assert.match(source, /StudyCoachPanel/);
  assert.match(source, /Study Coach Command/);
  assert.match(source, /Next best move/);
  assert.match(source, /Today's goal|Today’s goal/);
  assert.match(source, /confidence_reason|confidenceReason/);
});

test("progress page references study coach progress endpoint", () => {
  const source = read("pages/progress.jsx");
  assert.match(source, /\/study-coach\/progress/);
  assert.match(source, /Practice guidance/);
  assert.match(source, /Checkpoint goal/);
});

test("materials page references study coach materials endpoint", () => {
  const source = read("pages/documents.jsx");
  assert.match(source, /\/study-coach\/materials/);
  assert.match(source, /Coach Recommended Review Path/);
});

test("learning chat references study coach chat suggestions endpoint", () => {
  const source = read("pages/learning-chat.jsx");
  assert.match(source, /\/study-coach\/chat-suggestions/);
  assert.match(source, /Coach next question/);
  assert.match(source, /Quick Check timing/);
});

test("study coach panel supports advanced coaching sections", () => {
  const source = read("components/StudyCoachPanel.jsx");
  assert.match(source, /Study mode/i);
  assert.match(source, /Daily goal/i);
  assert.match(source, /Weekly plan/i);
  assert.match(source, /Recovery path/i);
});
