import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const readFromRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("stream page references classroom intelligence endpoint and panel", () => {
  const source = readFromRepo("pages/classrooms/[id]/stream.jsx");
  assert.match(source, /getClassroomIntelligence/);
  assert.match(source, /ClassroomIntelligencePanel/);
  assert.match(source, /About this stream/);
});

test("classwork page references classroom intelligence endpoint and panel", () => {
  const source = readFromRepo("pages/classrooms/[id]/classwork.jsx");
  assert.match(source, /getClassroomIntelligence/);
  assert.match(source, /ClassroomIntelligencePanel/);
  assert.match(source, /Classwork board/);
});

test("classroom intelligence panel supports teacher and student surfaces", () => {
  const source = readFromRepo("components/ClassroomIntelligencePanel.jsx");
  assert.match(source, /Classroom Command Center/);
  assert.match(source, /Student Focus Board/);
  assert.match(source, /Class patterns/);
  assert.match(source, /Reteach recommendations/);
  assert.match(source, /Study targets/);
  assert.match(source, /Ask next/);
  assert.match(source, /confidence_reason|confidenceReason/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1fr\)_340px\]/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
});
