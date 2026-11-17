import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  brigidGet,
  brigidInvoice,
  brigidInvoices,
  brigidLogin,
  brigidLogout,
  brigidMe,
  brigidPost,
  brigidTransaction,
  brigidTransactions,
} from "./brigid-api.ts";

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

test("brigidLogin, brigidMe, and brigidLogout call the session proxy endpoints", async () => {
  useFetch((path) => {
    if (path === "/api/brigid/login") {
      return jsonResponse(200, {
        token: "tok",
        user: { user_id: "u1", role: "owner", business_id: "b1", name: "Sari" },
      });
    }
    if (path === "/api/brigid/me") {
      return jsonResponse(200, {
        user_id: "u1",
        role: "owner",
        business_id: "b1",
        name: "Sari",
      });
    }
    return jsonResponse(200, { status: "logged_out" });
  });

  const login = await brigidLogin("owner@brigid.demo", "brigid123");
  const me = await brigidMe();
  const logout = await brigidLogout();

  assert.equal(calls[0].path, "/api/brigid/login");
  assert.equal(login.user.role, "owner");
  assert.equal(calls[1].path, "/api/brigid/me");
  assert.equal(me.name, "Sari");
  assert.equal(calls[2].path, "/api/brigid/logout");
  assert.equal(logout.status, "logged_out");
});

test("brigidInvoices and brigidTransactions build query parameters and detail paths", async () => {
  useFetch(() => jsonResponse(200, {}));

  await brigidInvoices({ kind: "payable", status: "open" });
  await brigidInvoice("inv/1");
  await brigidTransactions({
    direction: "out",
    from: "2026-01-01",
    to: "2026-02-01",
  });
  await brigidTransaction("tx_01");

  assert.equal(calls[0].path, "/api/brigid/invoices?kind=payable&status=open");
  assert.equal(calls[1].path, "/api/brigid/invoices/inv%2F1");
  assert.equal(
    calls[2].path,
    "/api/brigid/transactions?direction=out&from=2026-01-01&to=2026-02-01",
  );
  assert.equal(calls[3].path, "/api/brigid/transactions/tx_01");
});

test("a request timeout reports a clear timeout message", async () => {
  useFetch(() => {
    const err = new Error("The operation timed out");
    err.name = "TimeoutError";
    throw err;
  });

  await assert.rejects(brigidGet("info"), {
    message:
      "Brigid took too long to respond. Please check the server and retry.",
  });
});

test("every request attaches an AbortSignal timeout and surfaces proxy 504 errors", async () => {
  useFetch(() =>
    jsonResponse(504, {
      detail: "The Brigid API timed out waiting for a response. Please retry.",
    }),
  );

  await assert.rejects(brigidPost("chat", { role: "owner", text: "hi" }), {
    message: "The Brigid API timed out waiting for a response. Please retry.",
  });
  assert.ok(calls[0].init?.signal instanceof AbortSignal);
});
