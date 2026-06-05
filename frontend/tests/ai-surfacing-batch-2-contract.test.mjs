import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readFromRepo(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("document study page promotes Deep Study Mode", () => {
  const source = readFromRepo("pages", "document", "[id].jsx");
  assert.match(source, /Deep Study Mode/);
});

test("quiz maker promotes Assessment Intelligence Studio", () => {
  const source = readFromRepo("pages", "educator", "quiz-maker.jsx");
  assert.match(source, /Assessment Intelligence Studio/);
});

test("meeting room promotes AI Teaching Room", () => {
  const source = readFromRepo("components", "VideoMeetingRoom.jsx");
  assert.match(source, /AI Teaching Room/);
});

test("class insights promotes Insight Command Deck", () => {
  const source = readFromRepo("pages", "educator", "class-insights.jsx");
  assert.match(source, /Insight Command Deck/);
});

test("progress page promotes Progress Strategy Board", () => {
  const source = readFromRepo("pages", "progress.jsx");
  assert.match(source, /Progress Strategy Board/);
});
