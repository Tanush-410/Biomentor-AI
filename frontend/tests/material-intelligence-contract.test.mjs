import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("documents page references material intelligence endpoint and panel", () => {
  const source = read("pages/documents.jsx");
  assert.match(source, /MaterialIntelligencePanel/);
  assert.match(source, /\/material-intelligence/);
});

test("document viewer references material intelligence endpoint and panel", () => {
  const source = read("pages/document/[id].jsx");
  assert.match(source, /MaterialIntelligencePanel/);
  assert.match(source, /\/material-intelligence/);
});

test("material intelligence panel renders glossary and flashcards", () => {
  const source = read("components/MaterialIntelligencePanel.jsx");
  assert.match(source, /AI Material Intelligence/);
  assert.match(source, /Glossary/);
  assert.match(source, /Quick flashcards/);
  assert.match(source, /Revision bullets/);
  assert.match(source, /confidence_reason|confidenceReason/);
});

test("MaterialIntelligencePanel exposes advanced study sections", () => {
  const source = read("components/MaterialIntelligencePanel.jsx");
  assert.match(source, /Concept map/i);
  assert.match(source, /Misconception traps/i);
  assert.match(source, /Viva questions/i);
  assert.match(source, /Study path/i);
});

test("documents page gives material intelligence a primary entry point", () => {
  const source = read("pages/documents.jsx");
  assert.match(source, /Material Intelligence Preview/i);
  assert.match(source, /Review With Material Intelligence/i);
});

test("document study page treats material intelligence as a primary workspace", () => {
  const source = read("pages/document/[id].jsx");
  assert.match(source, /Material Intelligence Workspace/i);
  assert.match(source, /Ask Learning Chat/i);
  assert.match(source, /Generate Quiz From This Material/i);
});
