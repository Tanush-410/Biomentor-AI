import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const readFromRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("dashboard references educator copilot dashboard endpoint and panel", () => {
  const source = readFromRepo("pages/dashboard.jsx");
  assert.match(source, /\/educator\/copilot\/dashboard/);
  assert.match(source, /Educator Command Center/);
  assert.match(source, /Intervention plan/);
  assert.match(source, /EducatorCopilotPanel/);
  assert.match(source, /confidence_reason|confidenceReason/);
});

test("communication hub references communication copilot endpoint and draft usage", () => {
  const source = readFromRepo("pages/communication-hub.jsx");
  assert.match(source, /\/educator\/copilot\/communication/);
  assert.match(source, /Draft reason/);
  assert.match(source, /Escalation signal/);
  assert.match(source, /CopilotDraftCard/);
  assert.match(source, /applyDraft/);
});

test("class insights references insights copilot endpoint and recommendation panel", () => {
  const source = readFromRepo("pages/educator/class-insights.jsx");
  assert.match(source, /\/educator\/copilot\/class-insights/);
  assert.match(source, /Teaching move/);
  assert.match(source, /Review sequence/);
  assert.match(source, /CopilotRecommendationCard/);
});
