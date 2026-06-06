import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("backend proxy buffers request bodies before forwarding uploads", () => {
  const source = read("pages/api/backend/[...path].js");
  assert.match(source, /async function readRequestBody/);
  assert.match(source, /for await \(const chunk of req\)/);
  assert.match(source, /Buffer\.concat\(chunks\)/);
  assert.match(source, /requestHeaders\['content-length'\] = String\(requestBody\.length\)/);
});

test("documents pages use the same-origin backend proxy for hosted materials", () => {
  const documentsSource = read("pages/documents.jsx");
  const viewerSource = read("pages/document/[id].jsx");
  assert.match(documentsSource, /const documentsApi = \(path = ''\) => `\/api\/backend\/documents\$\{path\}`/);
  assert.match(documentsSource, /fetch\(documentsApi\('\/upload'\)/);
  assert.match(viewerSource, /const documentsApi = \(path = ''\) => `\/api\/backend\/documents\$\{path\}`/);
  assert.match(viewerSource, /fetch\(documentsApi\(`\/\$\{metadata\.id\}\/file`\)/);
});
