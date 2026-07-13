import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const readFromRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("app disables legacy service worker registration and clears old VYDRA CORE caches", () => {
  const source = readFromRepo("pages/_app.jsx");
  assert.match(source, /const LEGACY_CACHE_PREFIXES = \['biomentor-'\]/);
  assert.match(source, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(source, /registration\.unregister\(\)/);
  assert.match(source, /window\.caches\.keys\(\)/);
  assert.match(source, /name\.startsWith\(prefix\)/);
  assert.doesNotMatch(source, /navigator\.serviceWorker\.register\('/);
});
