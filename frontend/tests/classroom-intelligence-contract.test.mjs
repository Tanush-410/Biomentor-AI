import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("stream page references classroom intelligence endpoint and panel", () => {
  const source = fs.readFileSync("frontend/pages/classrooms/[id]/stream.jsx", "utf8");
  assert.match(source, /getClassroomIntelligence/);
  assert.match(source, /ClassroomIntelligencePanel/);
  assert.match(source, /About this stream/);
});

test("classwork page references classroom intelligence endpoint and panel", () => {
  const source = fs.readFileSync("frontend/pages/classrooms/[id]/classwork.jsx", "utf8");
  assert.match(source, /getClassroomIntelligence/);
  assert.match(source, /ClassroomIntelligencePanel/);
  assert.match(source, /Classwork board/);
});

test("classroom intelligence panel supports teacher and student surfaces", () => {
  const source = fs.readFileSync("frontend/components/ClassroomIntelligencePanel.jsx", "utf8");
  assert.match(source, /AI Classroom Intelligence/);
  assert.match(source, /Class Focus Coach/);
  assert.match(source, /Recommended next steps/);
  assert.match(source, /Next best moves/);
  assert.match(source, /confidence_reason|confidenceReason/);
});
