import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dashboard references educator copilot dashboard endpoint and panel", () => {
  const source = fs.readFileSync("frontend/pages/dashboard.jsx", "utf8");
  assert.match(source, /\/api\/educator\/copilot\/dashboard/);
  assert.match(source, /Daily intervention priorities/);
  assert.match(source, /EducatorCopilotPanel/);
  assert.match(source, /confidence_reason|confidenceReason/);
});

test("communication hub references communication copilot endpoint and draft usage", () => {
  const source = fs.readFileSync("frontend/pages/communication-hub.jsx", "utf8");
  assert.match(source, /\/api\/educator\/copilot\/communication/);
  assert.match(source, /Draft replies and handling guidance/);
  assert.match(source, /CopilotDraftCard/);
  assert.match(source, /applyDraft/);
});

test("class insights references insights copilot endpoint and recommendation panel", () => {
  const source = fs.readFileSync("frontend/pages/educator/class-insights.jsx", "utf8");
  assert.match(source, /\/api\/educator\/copilot\/class-insights/);
  assert.match(source, /Copilot interpretation and group review guidance/);
  assert.match(source, /CopilotRecommendationCard/);
});
