import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { isLocalRequest } from "@/lib/local-request";
import {
  type AuthIntent,
  OAUTH_PENDING_COOKIE,
  OAUTH_STATE_COOKIE,
  type OAuthProvider,
  buildLoginErrorUrl,
  getOAuthCredentials,
  parseOAuthProvider,
  providerDisplayName,
  signPendingOAuth,
} from "@/lib/oauth";

const BACKEND = process.env.BRIGID_API_ORIGIN ?? "http://127.0.0.1:8000";

type Context = { params: Promise<{ provider: string }> };

type OAuthProfile = {
  providerUserId: string;
  email: string;
  name: string;
};

function statesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function fetchGoogleProfile(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) {
    throw new Error("Could not complete Google token exchange.");
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Google did not return an access token.");
  }

  const userRes = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      cache: "no-store",
    },
  );
  if (!userRes.ok) {
    throw new Error("Could not load your Google profile.");
  }
  const userJson = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!userJson.sub || !userJson.email || userJson.email_verified === false) {
    throw new Error("Google did not provide a verified email address.");
  }
  return {
    providerUserId: userJson.sub,
    email: userJson.email,
    name: userJson.name?.trim() || userJson.email.split("@")[0],
  };
}

async function fetchGitHubProfile(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) {
    throw new Error("Could not complete GitHub token exchange.");
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("GitHub did not return an access token.");
  }

  const ghHeaders = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Brigid-Web",
  };

  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: ghHeaders,
      cache: "no-store",
    }),
    fetch("https://api.github.com/user/emails", {
      headers: ghHeaders,
      cache: "no-store",
    }),
  ]);

  if (!userRes.ok) {
    throw new Error("Could not load your GitHub profile.");
  }
  const userJson = (await userRes.json()) as {
    id?: number;
    login?: string;
    name?: string | null;
    email?: string | null;
  };

  let email = "";
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primaryVerified = emails.find((e) => e.primary && e.verified);
    const anyVerified = emails.find((e) => e.verified);
    email = primaryVerified?.email ?? anyVerified?.email ?? "";
  }
  if (!email && userJson.email) {
    email = userJson.email;
  }
  if (!userJson.id || !email) {
    throw new Error("GitHub did not provide a verified email address.");
  }

  return {
    providerUserId: String(userJson.id),
    email,
    name:
      userJson.name?.trim() ||
      userJson.login?.trim() ||
      email.split("@")[0],
  };
}

function redirectWithClearCookie(url: URL): NextResponse {
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(request: NextRequest, context: Context) {
  if (
    !isLocalRequest(request.headers.get("host"), request.headers.get("origin"))
  ) {
    return NextResponse.json({ detail: "Refused." }, { status: 403 });
  }

  const { provider: rawProvider } = await context.params;
  const provider: OAuthProvider | null = parseOAuthProvider(rawProvider);
  const origin = request.nextUrl.origin;

  const rawCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  let storedState: {
    state: string;
    intent: AuthIntent;
    provider: OAuthProvider;
  } | null = null;
  if (rawCookie) {
    try {
      storedState = JSON.parse(rawCookie) as {
        state: string;
        intent: AuthIntent;
        provider: OAuthProvider;
      };
    } catch {
      storedState = null;
    }
  }

  const intent: AuthIntent =
    storedState?.intent === "signup" ? "signup" : "login";

  if (!provider || !storedState || storedState.provider !== provider) {
    return redirectWithClearCookie(
      buildLoginErrorUrl(
        origin,
        intent,
        "Your sign-in session expired. Please try again.",
      ),
    );
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const label = providerDisplayName(provider);
    return redirectWithClearCookie(
      buildLoginErrorUrl(
        origin,
        intent,
        `${label} sign-in was cancelled or denied.`,
      ),
    );
  }

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  if (!code || !state || !statesMatch(state, storedState.state)) {
    return redirectWithClearCookie(
      buildLoginErrorUrl(
        origin,
        intent,
        "Invalid OAuth state. Please try again.",
      ),
    );
  }

  const creds = getOAuthCredentials(provider);
  if (!creds) {
    return redirectWithClearCookie(
      buildLoginErrorUrl(
        origin,
        intent,
        `${providerDisplayName(provider)} sign-in is not configured.`,
      ),
    );
  }

  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;

  try {
    const profile =
      provider === "google"
        ? await fetchGoogleProfile(
            code,
            redirectUri,
            creds.clientId,
            creds.clientSecret,
          )
        : await fetchGitHubProfile(
            code,
            redirectUri,
            creds.clientId,
            creds.clientSecret,
          );

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const internalSecret = process.env.BRIGID_INTERNAL_AUTH_SECRET;
    if (internalSecret) {
      headers["X-Brigid-Internal-Secret"] = internalSecret;
    }

    const backendRes = await fetch(new URL("/api/oauth/prepare", BACKEND), {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider,
        provider_user_id: profile.providerUserId,
        email: profile.email,
        name: profile.name,
        intent,
      }),
      cache: "no-store",
    });

    if (!backendRes.ok) {
      let detail = `${providerDisplayName(provider)} authentication failed.`;
      try {
        const errJson = (await backendRes.json()) as { detail?: string };
        if (errJson.detail) detail = errJson.detail;
      } catch {
        // Keep fallback error text.
      }
      return redirectWithClearCookie(
        buildLoginErrorUrl(origin, intent, detail),
      );
    }

    const prepareJson = (await backendRes.json()) as { status?: string };
    if (prepareJson.status === "needs_role") {
      const signedPending = signPendingOAuth({
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        name: profile.name,
      });
      if (!signedPending) {
        return redirectWithClearCookie(
          buildLoginErrorUrl(
            origin,
            intent,
            "Could not initialize role selection. Please retry.",
          ),
        );
      }
      const roleUrl = new URL("/login", origin);
      roleUrl.searchParams.set("mode", "signup");
      roleUrl.searchParams.set("step", "role");
      const response = NextResponse.redirect(roleUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      response.cookies.set(OAUTH_PENDING_COOKIE, signedPending, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
        secure: request.nextUrl.protocol === "https:",
      });
      return response;
    }

    const successUrl = new URL("/chat", origin);
    successUrl.searchParams.set("oauth", "1");
    const response = NextResponse.redirect(successUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE);

    const setCookies = backendRes.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      for (const value of setCookies) {
        response.headers.append("Set-Cookie", value);
      }
    } else {
      const single = backendRes.headers.get("set-cookie");
      if (single) response.headers.append("Set-Cookie", single);
    }
    return response;
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : `${providerDisplayName(provider)} sign-in failed.`;
    return redirectWithClearCookie(buildLoginErrorUrl(origin, intent, message));
  }
}
