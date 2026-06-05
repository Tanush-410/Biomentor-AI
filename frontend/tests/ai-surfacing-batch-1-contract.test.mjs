import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readFromRepo(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("dashboard promotes AI Mission Control", () => {
  const source = readFromRepo("pages", "dashboard.jsx");
  assert.match(source, /AI Mission Control/);
});

test("materials page promotes Material Intelligence Studio", () => {
  const source = readFromRepo("pages", "documents.jsx");
  assert.match(source, /Material Intelligence Studio/);
});

test("learning chat promotes AI Reasoning Mode", () => {
  const source = readFromRepo("pages", "learning-chat.jsx");
  assert.match(source, /AI Reasoning Mode/);
});

test("classroom stream promotes Classroom AI Board", () => {
  const source = readFromRepo("pages", "classrooms", "[id]", "stream.jsx");
  assert.match(source, /Classroom AI Board/);
});

test("communication hub promotes Copilot Response Center", () => {
  const source = readFromRepo("pages", "communication-hub.jsx");
  assert.match(source, /Copilot Response Center/);
});
