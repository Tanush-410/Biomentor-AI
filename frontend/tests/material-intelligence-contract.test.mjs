import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("documents page references material intelligence endpoint and panel", () => {
  const source = fs.readFileSync("frontend/pages/documents.jsx", "utf8");
  assert.match(source, /MaterialIntelligencePanel/);
  assert.match(source, /\/material-intelligence/);
});

test("document viewer references material intelligence endpoint and panel", () => {
  const source = fs.readFileSync("frontend/pages/document/[id].jsx", "utf8");
  assert.match(source, /MaterialIntelligencePanel/);
  assert.match(source, /\/material-intelligence/);
});

test("material intelligence panel renders glossary and flashcards", () => {
  const source = fs.readFileSync("frontend/components/MaterialIntelligencePanel.jsx", "utf8");
  assert.match(source, /AI Material Intelligence/);
  assert.match(source, /Glossary/);
  assert.match(source, /Quick flashcards/);
  assert.match(source, /Revision bullets/);
  assert.match(source, /confidence_reason|confidenceReason/);
});
