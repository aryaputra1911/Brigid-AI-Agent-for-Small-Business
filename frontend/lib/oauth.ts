import type { Role } from "@/lib/brigid-api";

export type OAuthProvider = "google" | "github";
export type AuthIntent = "login" | "signup";

export const OAUTH_STATE_COOKIE = "brigid_oauth_state";

export function parseOAuthProvider(value: string): OAuthProvider | null {
  if (value === "google" || value === "github") return value;
  return null;
}

export function parseAuthIntent(value: string | null): AuthIntent {
  return value === "signup" ? "signup" : "login";
}

export function parseSignupRole(value: string | null): Role {
  if (value === "owner" || value === "bookkeeper" || value === "staff") {
    return value;
  }
  return "owner";
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
