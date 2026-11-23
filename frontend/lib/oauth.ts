import crypto from "node:crypto";
import type { Role } from "@/lib/brigid-api";

export type OAuthProvider = "google" | "github";
export type AuthIntent = "login" | "signup";

export const OAUTH_STATE_COOKIE = "brigid_oauth_state";
export const OAUTH_PENDING_COOKIE = "brigid_oauth_pending";
const PENDING_TTL_MS = 10 * 60 * 1000;

export type PendingOAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name: string;
  exp: number;
};

export function parseOAuthProvider(value: string): OAuthProvider | null {
  if (value === "google" || value === "github") return value;
  return null;
}

export function parseAuthIntent(value: string | null): AuthIntent {
  return value === "signup" ? "signup" : "login";
}

export function parseSignupRole(value: string | null | undefined): Role | null {
  if (value === "owner" || value === "bookkeeper" || value === "staff") {
    return value;
  }
  return null;
}

export function getOAuthCredentials(provider: OAuthProvider): {
  clientId: string;
  clientSecret: string;
} | null {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }
  const clientId = process.env.GITHUB_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() ?? "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function pendingCookieSecret(provider: OAuthProvider): Buffer | null {
  const explicit = process.env.BRIGID_INTERNAL_AUTH_SECRET?.trim();
  if (explicit) {
    return crypto.createHash("sha256").update(explicit).digest();
  }
  const creds = getOAuthCredentials(provider);
  if (!creds) return null;
  return crypto
    .createHash("sha256")
    .update(`brigid-pending:${provider}:${creds.clientSecret}`)
    .digest();
}

export function signPendingOAuth(
  profile: Omit<PendingOAuthProfile, "exp">,
): string | null {
  const key = pendingCookieSecret(profile.provider);
  if (!key) return null;
  const payload: PendingOAuthProfile = {
    ...profile,
    exp: Date.now() + PENDING_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = crypto
    .createHmac("sha256", key)
    .update(encoded)
    .digest("base64url");
  return `${profile.provider}.${encoded}.${sig}`;
}

export function verifyPendingOAuth(
  token: string | undefined,
): PendingOAuthProfile | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawProvider, encoded, sig] = parts;
  const provider = parseOAuthProvider(rawProvider);
  if (!provider) return null;
  const key = pendingCookieSecret(provider);
  if (!key) return null;

  const expectedSig = crypto
    .createHmac("sha256", key)
    .update(encoded)
    .digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as PendingOAuthProfile;
    if (
      parsed.provider !== provider ||
      !parsed.providerUserId ||
      !parsed.email ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function providerDisplayName(provider: OAuthProvider): string {
  return provider === "google" ? "Google" : "GitHub";
}

export function buildLoginErrorUrl(
  origin: string,
  intent: AuthIntent,
  message: string,
): URL {
  const url = new URL("/login", origin);
  if (intent === "signup") {
    url.searchParams.set("mode", "signup");
  }
  url.searchParams.set("error", message);
  return url;
}
