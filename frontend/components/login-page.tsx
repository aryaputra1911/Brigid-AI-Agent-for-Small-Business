"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AmbientVideoBg } from "@/components/landing/ambient-video-bg";
import { BrigidLogo } from "@/components/ui/brigid-logo";
import {
  type AuthMode,
  LoginForm,
  type OAuthProvider,
} from "@/components/ui/login-form";
import {
  type Role,
  brigidLogin,
  brigidSignup,
} from "@/lib/brigid-api";

function LoginFormContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryMode: AuthMode =
    searchParams.get("mode") === "signup" ? "signup" : "login";
  const queryError = searchParams.get("error") ?? "";

  const [modeOverride, setModeOverride] = useState<AuthMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [errorOverride, setErrorOverride] = useState<string | null>(null);

  const mode = modeOverride ?? queryMode;
  const error = errorOverride ?? queryError;

  function handleModeChange(nextMode: AuthMode) {
    setModeOverride(nextMode);
    setErrorOverride("");
  }

  async function submitCredentials(
    nextEmail: string,
    nextPassword: string,
    activeMode: AuthMode,
    nextName?: string,
    nextRole?: Role,
  ) {
    setErrorOverride("");
    setSubmitting(true);
    try {
      if (activeMode === "signup") {
        await brigidSignup(nextName ?? "", nextEmail, nextPassword, nextRole);
      } else {
        await brigidLogin(nextEmail, nextPassword);
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("brigid_has_session", "1");
      }
      router.push("/chat");
      router.refresh();
    } catch (err) {
      setErrorOverride(
        err instanceof Error
          ? err.message
          : activeMode === "signup"
            ? "Sign up failed. Please check your details."
            : "Sign in failed. Check your email and password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOAuth(
    provider: OAuthProvider,
    activeMode: AuthMode,
    nextRole?: Role,
  ) {
    setErrorOverride("");
    setOauthLoading(provider);
    const params = new URLSearchParams({ intent: activeMode });
    if (activeMode === "signup" && nextRole) {
      params.set("role", nextRole);
    }
    window.location.href = `/api/auth/oauth/${provider}?${params.toString()}`;
  }

  return (
    <LoginForm
      mode={mode}
      onModeChange={handleModeChange}
      onSubmit={submitCredentials}
      onOAuth={handleOAuth}
      error={error}
      submitting={submitting}
      oauthLoading={oauthLoading}
    />
  );
}

export function LoginPage() {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#07020a] text-white">
      <AmbientVideoBg />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg px-2 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          <BrigidLogo decorative />
          <span>Brigid</span>
        </Link>
      </header>

      <main className="relative z-10 flex min-h-[calc(100dvh-76px)] items-center justify-center px-4 pb-20 pt-4">
        <Suspense
          fallback={
            <div className="login-glass-card w-full max-w-sm rounded-2xl p-8 text-center text-sm text-[#F1F7FF]/75">
              Loading sign-in form...
            </div>
          }
        >
          <LoginFormContainer />
        </Suspense>
      </main>
    </div>
  );
}
