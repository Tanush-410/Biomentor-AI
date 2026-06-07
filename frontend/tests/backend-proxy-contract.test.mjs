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

test("backend proxy preserves the trailing slash for the documents root endpoint", () => {
  const source = read("pages/api/backend/[...path].js");
  assert.match(source, /const needsTrailingSlash = pathSegments\.length === 1 && pathSegments\[0\] === 'documents'/);
  assert.match(source, /normalizedPath}\$\{needsTrailingSlash \? '\/' : ''}/);
});

test("documents pages prefer the hosted backend directly and keep the proxy as a fallback", () => {
  const documentsSource = read("pages/documents.jsx");
  const viewerSource = read("pages/document/[id].jsx");
  assert.match(documentsSource, /const directDocumentsApi = \(path = ''\) =>/);
  assert.match(documentsSource, /const proxiedDocumentsApi = \(path = ''\) => `\/api\/backend\/documents\$\{path\}`/);
  assert.match(documentsSource, /const fetchDocumentEndpoint = async \(path, options = \{\}\) =>/);
  assert.match(viewerSource, /const directDocumentsApi = \(path = ''\) =>/);
  assert.match(viewerSource, /const proxiedDocumentsApi = \(path = ''\) => `\/api\/backend\/documents\$\{path\}`/);
  assert.match(viewerSource, /const fetchDocumentEndpoint = async \(path, options = \{\}\) =>/);
});
