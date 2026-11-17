import { NextRequest, NextResponse } from "next/server";

import { isLocalRequest } from "@/lib/local-request";

const SINGLE_GET_ACTIONS = new Set([
  "info",
  "me",
  "pending",
  "invoices",
  "transactions",
]);
const DETAIL_GET_PREFIXES = new Set(["invoices", "transactions", "suppliers"]);
const POST_ACTIONS = new Set([
  "login",
  "logout",
  "chat",
  "confirm",
  "cancel",
  "mandate",
  "reset",
]);
const ALLOWED_QUERY_PARAMS: Record<string, readonly string[]> = {
  pending: ["role"],
  invoices: ["kind", "status"],
  transactions: ["direction", "from", "to"],
};
const BACKEND = process.env.BRIGID_API_ORIGIN ?? "http://127.0.0.1:8000";
// Exceeds the 25s backend LLM timeout so clean LLMError replies arrive, while staying under the 33s browser timeout.
const UPSTREAM_TIMEOUT_MS = 28_000;

type Context = { params: Promise<{ action: string[] }> };

// Every error this proxy produces itself carries the same strict headers as a forwarded one.
function jsonError(detail: string, status: number) {
  return NextResponse.json(
    { detail },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function resolveGetPath(segments: string[]): string | null {
  if (segments.length === 1 && SINGLE_GET_ACTIONS.has(segments[0])) {
    return `/api/${segments[0]}`;
  }
  if (
    segments.length === 2 &&
    DETAIL_GET_PREFIXES.has(segments[0]) &&
    segments[1].length > 0 &&
    segments[1] !== "." &&
    segments[1] !== ".."
  ) {
    return `/api/${segments[0]}/${encodeURIComponent(segments[1])}`;
  }
  return null;
}

export async function GET(request: NextRequest, context: Context) {
  const { action } = await context.params;
  const path = resolveGetPath(action);
  if (!path) return jsonError("Not found.", 404);
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return jsonError("Refused.", 403);
  }
  const upstream = new URL(path, BACKEND);
  if (action.length === 1) {
    const allowedParams = ALLOWED_QUERY_PARAMS[action[0]] ?? [];
    for (const key of allowedParams) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) upstream.searchParams.set(key, value);
    }
  }
  return forward(upstream, request);
}

export async function POST(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (action.length !== 1 || !POST_ACTIONS.has(action[0])) {
    return jsonError("Not found.", 404);
  }
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return jsonError("Refused.", 403);
  }
  // Media types are case-insensitive, so compare lowercased.
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return jsonError("Refused.", 403);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON.", 400);
  }
  return forward(
    new URL(`/api/${action[0]}`, BACKEND),
    request,
    JSON.stringify(body),
  );
}

async function forward(url: URL, request: NextRequest, body?: string) {
  try {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const cookie = request.headers.get("cookie");
    if (cookie) {
      headers["Cookie"] = cookie;
    }

    // The browser Origin is intentionally not passed to FastAPI; the proxy sends only JSON + session cookie.
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await response.text();
    const out = new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      for (const value of setCookies) {
        out.headers.append("Set-Cookie", value);
      }
    } else {
      const singleSetCookie = response.headers.get("set-cookie");
      if (singleSetCookie) {
        out.headers.append("Set-Cookie", singleSetCookie);
      }
    }
    return out;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return jsonError(
        "The Brigid API timed out waiting for a response. Please retry.",
        504,
      );
    }
    return jsonError(
      "The Brigid API is unavailable. Start FastAPI on the configured local origin.",
      503,
    );
  }
}
