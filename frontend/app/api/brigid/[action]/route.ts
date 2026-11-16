import { NextRequest, NextResponse } from "next/server";

import { isLocalRequest } from "@/lib/local-request";

const GET_ACTIONS = new Set(["info", "pending"]);
const POST_ACTIONS = new Set(["chat", "confirm", "cancel", "mandate", "reset"]);
const BACKEND = process.env.BRIGID_API_ORIGIN ?? "http://127.0.0.1:8000";

type Context = { params: Promise<{ action: string }> };

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

export async function GET(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (!GET_ACTIONS.has(action)) return jsonError("Not found.", 404);
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return jsonError("Refused.", 403);
  }
  const upstream = new URL(`/api/${action}`, BACKEND);
  if (action === "pending") {
    const role = request.nextUrl.searchParams.get("role");
    if (role) upstream.searchParams.set("role", role);
  }
  return forward(upstream);
}

export async function POST(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (!POST_ACTIONS.has(action)) return jsonError("Not found.", 404);
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
  return forward(new URL(`/api/${action}`, BACKEND), JSON.stringify(body));
}

async function forward(url: URL, body?: string) {
  try {
    // The browser Origin is intentionally not passed to FastAPI; the proxy sends only JSON.
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError(
      "The Brigid API is unavailable. Start FastAPI on the configured local origin.",
      503,
    );
  }
}
