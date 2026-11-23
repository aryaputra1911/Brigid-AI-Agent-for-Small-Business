import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { isLocalRequest } from "@/lib/local-request";
import {
  OAUTH_STATE_COOKIE,
  buildLoginErrorUrl,
  getOAuthCredentials,
  parseAuthIntent,
  parseOAuthProvider,
  providerDisplayName,
} from "@/lib/oauth";

type Context = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: Context) {
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return NextResponse.json({ detail: "Refused." }, { status: 403 });
  }

  const { provider: rawProvider } = await context.params;
  const provider = parseOAuthProvider(rawProvider);
  const intent = parseAuthIntent(request.nextUrl.searchParams.get("intent"));
  const origin = request.nextUrl.origin;

  if (!provider) {
    return NextResponse.redirect(
      buildLoginErrorUrl(origin, intent, "Unsupported sign-in provider."),
    );
  }

  const creds = getOAuthCredentials(provider);
  if (!creds) {
    const label = providerDisplayName(provider);
    const envPrefix = provider === "google" ? "GOOGLE" : "GITHUB";
    return NextResponse.redirect(
      buildLoginErrorUrl(
        origin,
        intent,
        `${label} sign-in is not configured yet. Set ${envPrefix}_CLIENT_ID and ${envPrefix}_CLIENT_SECRET in .env.`,
      ),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;

  const authUrl =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://github.com/login/oauth/authorize");

  authUrl.searchParams.set("client_id", creds.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  if (provider === "google") {
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
  } else {
    authUrl.searchParams.set("scope", "read:user user:email");
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    JSON.stringify({ state, intent, provider }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: request.nextUrl.protocol === "https:",
    },
  );
  return response;
}
