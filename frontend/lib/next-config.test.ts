import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import nextConfig from "../next.config.ts";

test("every page refuses to be framed by another website", async () => {
  const rules = await nextConfig.headers?.();
  const everyPage = rules?.find((rule) => rule.source === "/:path*");
  const headers = new Map(
    everyPage?.headers.map(({ key, value }) => [key, value]),
  );

  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.match(
    headers.get("Content-Security-Policy") ?? "",
    /frame-ancestors 'none'/,
  );
});

test("every page tells browsers not to guess content types", async () => {
  const rules = await nextConfig.headers?.();
  const everyPage = rules?.find((rule) => rule.source === "/:path*");
  const headers = new Map(
    everyPage?.headers.map(({ key, value }) => [key, value]),
  );

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
});

test("every page sets strict CSP directives and Referrer-Policy", async () => {
  const rules = await nextConfig.headers?.();
  const everyPage = rules?.find((rule) => rule.source === "/:path*");
  const headers = new Map(
    everyPage?.headers.map(({ key, value }) => [key, value]),
  );

  assert.equal(headers.get("Referrer-Policy"), "no-referrer");
  const csp = headers.get("Content-Security-Policy") ?? "";
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "connect-src 'self'",
    "worker-src 'self'",
  ]) {
    assert.match(csp, new RegExp(directive));
  }
});

test("the dev server only trusts this computer", () => {
  assert.deepEqual(nextConfig.allowedDevOrigins, ["127.0.0.1"]);
});

test("invoice and transaction list rows disable automatic RSC viewport prefetching", () => {
  const invoicesSource = readFileSync(
    join(process.cwd(), "components/invoices-page.tsx"),
    "utf8",
  );
  const transactionsSource = readFileSync(
    join(process.cwd(), "components/transactions-page.tsx"),
    "utf8",
  );

  assert.match(
    invoicesSource,
    /href=\{`\/invoices\/\$\{encodeURIComponent\(invoice\.id\)\}`\}[\s\S]*?prefetch=\{false\}/,
  );
  assert.match(
    transactionsSource,
    /href=\{`\/transactions\/\$\{encodeURIComponent\(tx\.id\)\}`\}[\s\S]*?prefetch=\{false\}/,
  );
});

