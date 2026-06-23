import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("backend proxy buffers request bodies before forwarding uploads", () => {
  const source = read("pages/api/backend/[[...path]].js");
  assert.match(source, /async function readRequestBody/);
  assert.match(source, /for await \(const chunk of req\)/);
  assert.match(source, /Buffer\.concat\(chunks\)/);
  assert.match(source, /requestHeaders\['content-length'\] = String\(requestBody\.length\)/);
});

test("backend proxy requests identity encoding and writes raw response bytes", () => {
  const source = read("pages/api/backend/[[...path]].js");
  assert.match(source, /requestHeaders\['accept-encoding'\] = 'identity'/);
  assert.match(source, /Cache-Control', 'private, no-store'/);
  assert.match(source, /res\.end\(Buffer\.from\(arrayBuffer\)\)/);
});

test("backend proxy preserves the trailing slash for the documents root endpoint", () => {
  const source = read("pages/api/backend/[[...path]].js");
  assert.match(source, /const needsTrailingSlash = pathSegments\.length === 1 && pathSegments\[0\] === 'documents'/);
  assert.match(source, /normalizedPath}\$\{needsTrailingSlash \? '\/' : ''}/);
});

test("backend proxy accepts either server-only or public backend env vars", () => {
  const source = read("pages/api/backend/[[...path]].js");
  assert.match(source, /process\.env\.API_URL \|\|\s+process\.env\.NEXT_PUBLIC_API_URL/);
  assert.match(source, /DEFAULT_HOSTED_BACKEND_ORIGIN/);
});

test("documents pages use the shared backend fallback helper", () => {
  const documentsSource = read("pages/documents.jsx");
  const viewerSource = read("pages/document/[id].jsx");
  const helperSource = read("lib/backendApi.js");
  assert.match(helperSource, /export async function fetchBackendWithFallback/);
  assert.match(helperSource, /export function proxiedBackendApi/);
  assert.match(helperSource, /export function isHostedFrontend/);
  assert.match(documentsSource, /const fetchDocumentEndpoint = async \(path, options = \{\}\) =>/);
  assert.match(documentsSource, /fetchBackendWithFallback\(`\/documents\$\{path\}`/);
  assert.match(documentsSource, /await readErrorDetail\(response\)/);
  assert.match(documentsSource, /setError\(err\?\.message \|\| 'Unable to connect to the server\.'\)/);
  assert.match(viewerSource, /const fetchDocumentEndpoint = async \(path, options = \{\}\) =>/);
  assert.match(viewerSource, /fetchBackendWithFallback\(`\/documents\$\{path\}`/);
  assert.match(viewerSource, /await readErrorDetail\(response\)/);
  assert.match(viewerSource, /setError\(err\?\.message \|\| 'Unable to connect to the server\.'\)/);
});
