import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadBackendApiModule() {
  const sourcePath = new URL("../lib/backendApi.js", import.meta.url);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "backend-api-test-"));
  const tempPath = path.join(tempDir, "backendApi.mjs");
  fs.writeFileSync(tempPath, fs.readFileSync(sourcePath, "utf8"));
  return import(pathToFileURL(tempPath).href);
}

test("hosted requests prefer the deployed backend directly and keep the Vercel proxy as fallback", async () => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.biomentor.example";
  delete process.env.NEXT_PUBLIC_API_PROXY_ONLY;
  const backendApi = await loadBackendApiModule();

  global.window = {
    location: { hostname: "biomentor-ai-delta.vercel.app" },
  };

  assert.deepEqual(backendApi.buildBackendCandidates("/documents/"), [
    "https://api.biomentor.example/api/documents/",
    "/api/backend/documents/",
  ]);
});

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

test("requestBackendJson retries the alternate hosted backend path when the first successful response has no JSON payload", async () => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.biomentor.example";
  const backendApi = await loadBackendApiModule();

  global.window = {
    location: { hostname: "biomentor-ai-delta.vercel.app" },
  };

  let attempt = 0;
  global.fetch = async (url) => {
    attempt += 1;

    if (attempt === 1) {
      assert.equal(url, "/api/backend/auth/login");
      return new Response("", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    assert.equal(url, "https://api.biomentor.example/api/auth/login");
    return new Response(
      JSON.stringify({
        access_token: "demo-token",
        token_type: "bearer",
        user: { id: "u1", role: "student" },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const payload = await backendApi.requestBackendJson("/auth/login", {
    method: "POST",
    body: { email: "student@example.com", password: "secret123" },
  }, { preferProxy: true });

  assert.equal(attempt, 2);
  assert.equal(payload.access_token, "demo-token");
});

test("requestBackendJson retries the alternate hosted backend path when the proxy returns 204 for a JSON request", async () => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.biomentor.example";
  const backendApi = await loadBackendApiModule();

  global.window = {
    location: { hostname: "biomentor-ai-delta.vercel.app" },
  };

  let attempt = 0;
  global.fetch = async (url) => {
    attempt += 1;

    if (attempt === 1) {
      assert.equal(url, "/api/backend/auth/login");
      return new Response(null, { status: 204 });
    }

    assert.equal(url, "https://api.biomentor.example/api/auth/login");
    return new Response(
      JSON.stringify({
        access_token: "fallback-token",
        token_type: "bearer",
        user: { id: "u2", role: "educator" },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const payload = await backendApi.requestBackendJson("/auth/login", {
    method: "POST",
    body: { email: "educator@example.com", password: "secret123" },
  }, { preferProxy: true });

  assert.equal(attempt, 2);
  assert.equal(payload.access_token, "fallback-token");
});

test("requestBackendJson accepts an empty successful DELETE without retrying it", async () => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.biomentor.example";
  const backendApi = await loadBackendApiModule();

  global.window = {
    location: { hostname: "biomentor-ai-delta.vercel.app" },
  };

  let attempt = 0;
  global.fetch = async (url) => {
    attempt += 1;
    assert.equal(url, "https://api.biomentor.example/api/sticky-notes/note-1");
    return new Response(null, { status: 204 });
  };

  const payload = await backendApi.requestBackendJson("/sticky-notes/note-1", {
    method: "DELETE",
  }, { preferProxy: false });

  assert.equal(attempt, 1);
  assert.equal(payload, null);
});

test("hosted frontend ignores a loopback API origin and uses the deployed backend for HTTP and WebSockets", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  delete process.env.NEXT_PUBLIC_WS_URL;
  const backendApi = await loadBackendApiModule();

  global.window = {
    location: {
      hostname: "biomentor-ai-delta.vercel.app",
      protocol: "https:",
    },
  };

  assert.equal(backendApi.backendOrigin(), "https://biomentor-ai.onrender.com");
  assert.equal(
    backendApi.directBackendApi("/auth/login"),
    "https://biomentor-ai.onrender.com/api/auth/login",
  );
  assert.equal(backendApi.toWebSocketBase(), "wss://biomentor-ai.onrender.com");
});
