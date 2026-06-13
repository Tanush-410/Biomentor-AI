import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadBackendApiModule() {
  const sourcePath = path.resolve(process.cwd(), "frontend/lib/backendApi.js");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "backend-api-test-"));
  const tempPath = path.join(tempDir, "backendApi.mjs");
  fs.writeFileSync(tempPath, fs.readFileSync(sourcePath, "utf8"));
  return import(pathToFileURL(tempPath).href);
}

test("fetchBackendWithFallback does not retry non-idempotent upload requests after a backend 500", async () => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.biomentor.example";
  const backendApi = await loadBackendApiModule();
  const responsePayload = { detail: "Unable to persist the uploaded file: storage offline" };

  global.window = {
    location: { hostname: "biomentor-ai-delta.vercel.app" },
  };

  let attempt = 0;
  global.fetch = async () => {
    attempt += 1;
    if (attempt === 1) {
      return new Response(JSON.stringify(responsePayload), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error("Failed to fetch");
  };

  const response = await backendApi.fetchBackendWithFallback("/documents/upload", {
    method: "POST",
    body: new FormData(),
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), responsePayload);
  assert.equal(attempt, 1);
});

test("fetchBackendWithFallback preserves the first backend response detail across fallback retries", async () => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.biomentor.example";
  const backendApi = await loadBackendApiModule();

  global.window = {
    location: { hostname: "biomentor-ai-delta.vercel.app" },
  };

  let attempt = 0;
  global.fetch = async () => {
    attempt += 1;
    if (attempt === 1) {
      return new Response(JSON.stringify({ detail: "Document service temporarily unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error("Network path unavailable");
  };

  await assert.rejects(
    backendApi.fetchBackendWithFallback("/documents/", {
      method: "GET",
    }),
    /Document service temporarily unavailable/,
  );
  assert.equal(attempt, 2);
});
