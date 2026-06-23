import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("saved sessions are validated with the backend even when a cached user profile exists", () => {
  const source = read("context/AuthContext.jsx");
  assert.match(source, /requestBackendJson\('\/auth\/me'/);
  assert.doesNotMatch(source, /if \(savedToken && !savedUser\)/);
  assert.match(source, /setToken\(null\)/);
  assert.match(source, /setUser\(null\)/);
});

test("the application wraps page features in a visible recovery boundary", () => {
  const source = read("pages/_app.jsx");
  assert.match(source, /FeatureBoundary name="Page"/);
  assert.match(source, /Something went wrong in this workspace/);
  assert.match(source, /window\.location\.reload\(\)/);
});
