import { NextRequest, NextResponse } from "next/server";

import { isLocalRequest } from "@/lib/local-request";
import { OAUTH_PENDING_COOKIE, verifyPendingOAuth } from "@/lib/oauth";

export async function GET(request: NextRequest) {
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return NextResponse.json({ detail: "Refused." }, { status: 403 });
  }

  const pending = verifyPendingOAuth(
    request.cookies.get(OAUTH_PENDING_COOKIE)?.value,
  );
  if (!pending) {
    return NextResponse.json(
      { detail: "No pending OAuth sign-up session." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      provider: pending.provider,
      email: pending.email,
      name: pending.name,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: NextRequest) {
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return NextResponse.json({ detail: "Refused." }, { status: 403 });
  }

  const res = NextResponse.json(
    { status: "cleared" },
    { headers: { "Cache-Control": "no-store" } },
  );
  res.cookies.delete(OAUTH_PENDING_COOKIE);
  return res;
}
