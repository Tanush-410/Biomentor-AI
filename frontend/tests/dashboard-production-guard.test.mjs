import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const readFromRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("educator dashboard guards websocket setup and normalizes list-shaped data before mapping", () => {
  const source = readFromRepo("pages/dashboard.jsx");
  assert.match(source, /const apiBase = toWebSocketBase\(\)/);
  assert.match(source, /if \(!apiBase\) return undefined/);
  assert.match(source, /function normalizeList\(value\)/);
  assert.match(source, /alerts: normalizeObjectList\(payload\?\.alerts\)/);
  assert.match(source, /classrooms: normalizeObjectList\(payload\?\.classrooms\)/);
  assert.match(source, /messages: normalizeObjectList\(messages\)/);
  assert.match(source, /const educatorAlerts = normalizeList\(educatorData\?\.alerts\)/);
  assert.match(source, /const educatorClassrooms = normalizeList\(educatorData\?\.classrooms\)/);
  assert.match(source, /const educatorMessages = normalizeList\(educatorData\?\.messages\)/);
  assert.match(source, /const educatorLiveSessions = normalizeList\(educatorData\?\.live_sessions\)/);
  assert.match(source, /const educatorComplaints = normalizeList\(educatorData\?\.complaints\)/);
  assert.match(source, /const copilotPriorities = normalizeList\(educatorCopilot\?\.priorities\)/);
});
