"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AmbientVideoBg } from "@/components/landing/ambient-video-bg";
import { BrigidLogo } from "@/components/ui/brigid-logo";
import {
  type AuthMode,
  LoginForm,
  type OAuthProvider,
  OAuthRoleStep,
} from "@/components/ui/login-form";
import {
  type PendingOAuthAccount,
  type Role,
  brigidLogin,
  brigidOAuthCancel,
  brigidOAuthFinalize,
  brigidOAuthPending,
  brigidSignup,
} from "@/lib/brigid-api";

function LoginFormContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryMode: AuthMode =
    searchParams.get("mode") === "signup" ? "signup" : "login";
  const queryStep = searchParams.get("step");
  const queryError = searchParams.get("error") ?? "";

  const [modeOverride, setModeOverride] = useState<AuthMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [errorOverride, setErrorOverride] = useState<string | null>(null);
  const [pendingOAuth, setPendingOAuth] = useState<PendingOAuthAccount | null>(
    null,
  );
  const [pendingLoading, setPendingLoading] = useState(queryStep === "role");

  const mode = modeOverride ?? queryMode;
  const error = errorOverride ?? queryError;

  useEffect(() => {
    function resetPendingButtons() {
      setOauthLoading(null);
      setSubmitting(false);
    }
    window.addEventListener("pageshow", resetPendingButtons);
    window.addEventListener("popstate", resetPendingButtons);
    return () => {
      window.removeEventListener("pageshow", resetPendingButtons);
      window.removeEventListener("popstate", resetPendingButtons);
    };
  }, []);

  useEffect(() => {
    if (queryStep !== "role") {
      return;
    }
    let active = true;
    void brigidOAuthPending()
      .then((found) => {
        if (!active) return;
        if (!found) {
          setErrorOverride(
            "Your OAuth sign-up session expired. Please sign up again.",
          );
          router.replace("/login?mode=signup");
        } else {
          setPendingOAuth(found);
        }
      })
      .catch((err) => {
        if (!active) return;
        setErrorOverride(
          err instanceof Error
            ? err.message
            : "Could not load your OAuth sign-up session.",
        );
        router.replace("/login?mode=signup");
      })
      .finally(() => {
        if (active) setPendingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [queryStep, router]);

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

  function handleOAuth(provider: OAuthProvider, activeMode: AuthMode) {
    setErrorOverride("");
    setOauthLoading(provider);
    window.location.href = `/api/auth/oauth/${provider}?intent=${encodeURIComponent(activeMode)}`;
  }

  async function handleFinalizeOAuth(role: Role) {
    setErrorOverride("");
    setSubmitting(true);
    try {
      await brigidOAuthFinalize(role);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("brigid_has_session", "1");
      }
      router.push("/chat");
      router.refresh();
    } catch (err) {
      setErrorOverride(
        err instanceof Error
          ? err.message
          : "Could not complete OAuth sign up. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelOAuth() {
    setErrorOverride("");
    await brigidOAuthCancel();
    setPendingOAuth(null);
    setModeOverride("signup");
    router.replace("/login?mode=signup");
  }

  if (queryStep === "role") {
    if (pendingLoading) {
      return (
        <div className="login-glass-card w-full max-w-sm rounded-2xl p-8 text-center text-sm text-[#F1F7FF]/75">
          Loading account details...
        </div>
      );
    }
    if (pendingOAuth) {
      return (
        <OAuthRoleStep
          pending={pendingOAuth}
          onConfirm={handleFinalizeOAuth}
          onCancel={handleCancelOAuth}
          error={error}
          submitting={submitting}
        />
      );
    }
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

      <header className="relative z-10 flex items-center justify-between pt-[calc(1rem+env(safe-area-inset-top))] pb-4 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] sm:pl-[calc(2rem+env(safe-area-inset-left))] sm:pr-[calc(2rem+env(safe-area-inset-right))]">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg px-2 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          <BrigidLogo decorative />
          <span>Brigid</span>
        </Link>
      </header>

      <main className="relative z-10 flex min-h-[calc(100dvh-76px-env(safe-area-inset-top))] items-center justify-center pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
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
