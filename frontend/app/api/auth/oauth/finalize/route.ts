import { NextRequest, NextResponse } from "next/server";

import { isLocalRequest } from "@/lib/local-request";
import {
  OAUTH_PENDING_COOKIE,
  parseSignupRole,
  verifyPendingOAuth,
} from "@/lib/oauth";

const BACKEND = process.env.BRIGID_API_ORIGIN ?? "http://127.0.0.1:8000";

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

export async function POST(request: NextRequest) {
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return jsonError("Refused.", 403);
  }

  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return jsonError("Refused.", 403);
  }

  const pending = verifyPendingOAuth(
    request.cookies.get(OAUTH_PENDING_COOKIE)?.value,
  );
  if (!pending) {
    return jsonError(
      "Your OAuth sign-up session expired. Please sign up again.",
      401,
    );
  }

  let body: { role?: string };
  try {
    body = (await request.json()) as { role?: string };
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const role = parseSignupRole(body.role);
  if (!role) {
    return jsonError("Choose a valid role.", 422);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const internalSecret = process.env.BRIGID_INTERNAL_AUTH_SECRET;
  if (internalSecret) {
    headers["X-Brigid-Internal-Secret"] = internalSecret;
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(new URL("/api/oauth/complete", BACKEND), {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider: pending.provider,
        provider_user_id: pending.providerUserId,
        email: pending.email,
        name: pending.name,
        intent: "signup",
        role,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(28_000),
    });
  } catch {
    return jsonError(
      "The Brigid API is unavailable. Start FastAPI on the configured local origin.",
      503,
    );
  }

  const data = await backendRes.text();
  const out = new NextResponse(data, {
    status: backendRes.status,
    headers: {
      "Content-Type":
        backendRes.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

  if (backendRes.ok) {
    out.cookies.delete(OAUTH_PENDING_COOKIE);
    const setCookies = backendRes.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      for (const value of setCookies) {
        out.headers.append("Set-Cookie", value);
      }
    } else {
      const single = backendRes.headers.get("set-cookie");
      if (single) out.headers.append("Set-Cookie", single);
    }
  }
  return out;
}
