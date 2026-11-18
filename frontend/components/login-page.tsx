"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AmbientVideoBg } from "@/components/landing/ambient-video-bg";
import { BrigidLogo } from "@/components/ui/brigid-logo";
import { LoginForm } from "@/components/ui/login-form";
import { brigidLogin } from "@/lib/brigid-api";

export function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitCredentials(nextEmail: string, nextPassword: string) {
    setError("");
    setSubmitting(true);
    try {
      await brigidLogin(nextEmail, nextPassword);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("brigid_has_session", "1");
      }
      router.push("/chat");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign in failed. Check your email and password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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
        <LoginForm
          onSubmit={submitCredentials}
          error={error}
          submitting={submitting}
        />
      </main>
    </div>
  );
}
