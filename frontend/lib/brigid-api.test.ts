import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { brigidGet, brigidPost } from "./brigid-api.ts";

const realFetch = globalThis.fetch;
const calls: { path: string; init: RequestInit | undefined }[] = [];

function useFetch(
  handler: (path: string, init?: RequestInit) => Response | Promise<Response>,
) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), init });
    return handler(String(input), init);
  }) as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  calls.length = 0;
  globalThis.fetch = realFetch;
});

test("brigidGet calls the proxy path and adds the role query parameter", async () => {
  useFetch(() =>
    jsonResponse(200, { simulation: "SIM", roles: [], screening_model: false }),
  );

  const info = await brigidGet<{ simulation: string }>("info");
  await brigidGet("pending", "bookkeeper");

  assert.equal(calls[0].path, "/api/brigid/info");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.equal(calls[1].path, "/api/brigid/pending?role=bookkeeper");
  assert.equal(info.simulation, "SIM");
});

test("brigidGet encodes the role value", async () => {
  useFetch(() => jsonResponse(200, {}));

  await brigidGet("pending", "owner");

  assert.equal(calls[0].path, "/api/brigid/pending?role=owner");
});

test("brigidPost sends JSON to the proxy path", async () => {
  useFetch(() => jsonResponse(200, { status: "reset" }));

  const result = await brigidPost<{ status: string }>("reset", {
    role: "owner",
  });

  assert.equal(calls[0].path, "/api/brigid/reset");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(calls[0].init?.headers, {
    "Content-Type": "application/json",
  });
  assert.equal(calls[0].init?.body, JSON.stringify({ role: "owner" }));
  assert.deepEqual(result, { status: "reset" });
});

test("a network failure explains that the local service is unreachable", async () => {
  useFetch(() => {
    throw new TypeError("fetch failed");
  });

  await assert.rejects(brigidGet("info"), {
    message:
      "The local Brigid service is unavailable. Check both servers and retry.",
  });
});

test("a response that is not JSON is reported as unreadable", async () => {
  useFetch(() => new Response("<html>boom</html>", { status: 200 }));

  await assert.rejects(brigidGet("info"), {
    message: "Brigid returned an unreadable response. Please retry.",
  });
});

test("a server error with a detail message carries that message", async () => {
  useFetch(() => jsonResponse(403, { detail: "Refused." }));

  await assert.rejects(brigidGet("info"), { message: "Refused." });
});

test("a server error without a detail message names the status", async () => {
  useFetch(() => jsonResponse(500, { unexpected: true }));

  await assert.rejects(brigidGet("info"), {
    message: "Brigid request failed (500).",
  });
});
