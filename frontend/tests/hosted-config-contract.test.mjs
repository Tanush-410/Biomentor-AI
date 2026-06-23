import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Next production config does not compile localhost as the public API fallback", () => {
  const source = read("next.config.js");
  assert.doesNotMatch(source, /NEXT_PUBLIC_API_URL:[\s\S]*localhost:8000/);
});
