import assert from "node:assert/strict";
import { test } from "node:test";

import { isLocalRequest } from "./local-request.ts";

test("a page on a local host name may reach the API", () => {
  assert.equal(isLocalRequest("localhost:3000", "http://localhost:3000"), true);
  assert.equal(isLocalRequest("127.0.0.1:3000", "http://127.0.0.1:3000"), true);
  assert.equal(isLocalRequest("[::1]:3000", "http://[::1]:3000"), true);
});

test("a request without an Origin header from a local host name is allowed", () => {
  assert.equal(isLocalRequest("127.0.0.1:3000", null), true);
});

test("a website whose name was pointed at this computer is refused", () => {
  assert.equal(
    isLocalRequest("evil.example:3000", "http://evil.example:3000"),
    false,
  );
  assert.equal(isLocalRequest("evil.example:3000", null), false);
});

test("a local Host header with a foreign Origin is refused", () => {
  assert.equal(isLocalRequest("localhost:3000", "https://evil.example"), false);
});

test("an Origin that is not a URL is refused", () => {
  assert.equal(isLocalRequest("localhost:3000", "null"), false);
});

test("a missing or malformed Host header is refused", () => {
  assert.equal(isLocalRequest(null, null), false);
  assert.equal(isLocalRequest("localhost@evil.example", null), false);
});

test("configured Vercel or allowed deployment hosts are accepted only for matching origins", () => {
  const env = {
    VERCEL_URL: "brigid-preview.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "brigid-one.vercel.app",
    BRIGID_ALLOWED_HOSTS: "custom.example.com",
  };
  assert.equal(
    isLocalRequest(
      "brigid-one.vercel.app",
      "https://brigid-one.vercel.app",
      env,
    ),
    true,
  );
  assert.equal(isLocalRequest("brigid-preview.vercel.app", null, env), true);
  assert.equal(
    isLocalRequest("custom.example.com", "https://custom.example.com", env),
    true,
  );
  assert.equal(
    isLocalRequest("brigid-one.vercel.app", "http://localhost:3000", env),
    false,
  );
  assert.equal(
    isLocalRequest("brigid-one.vercel.app", "https://evil.example", env),
    false,
  );
});
