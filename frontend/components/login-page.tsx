"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { brigidLogin } from "@/lib/brigid-api";
import { BrigidLogo } from "@/components/ui/brigid-logo";
import "./login-page.css";

const DEMO_ACCOUNTS = [
  {
    label: "Sari (Owner)",
    role: "owner",
    email: "owner@brigid.demo",
    password: "brigid123",
  },
  {
    label: "Dewi (Bookkeeper)",
    role: "bookkeeper",
    email: "bookkeeper@brigid.demo",
    password: "brigid123",
  },
  {
    label: "Rudi (Staff)",
    role: "staff",
    email: "staff@brigid.demo",
    password: "brigid123",
  },
] as const;

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }
    void submitCredentials(email.trim(), password);
  }

  return (
    <div className="brigid-login-page">
      <aside className="brigid-login-brand" aria-label="Brigid overview">
        <div className="brigid-login-brand-top">
          <Link href="/" className="brigid-login-home">
            <BrigidLogo />
            <span>Brigid</span>
          </Link>
          <Link href="/" className="brigid-login-back">
            Back to home
          </Link>
        </div>
        <div className="brigid-login-pitch">
          <span className="brigid-login-kicker">Simulation workspace</span>
          <h2>Role-scoped finance approvals in one place.</h2>
          <p>
            Sign in with a demo account to inspect invoices, review bank
            transactions, and confirm payment proposals with Ed25519-backed
            guardrails.
          </p>
        </div>
        <p className="brigid-login-note">
          Local simulation only. Demo accounts use synthetic data and no real
          bank connections.
        </p>
      </aside>

      <main className="brigid-login-main">
        <div className="brigid-login-card">
          <div className="brigid-login-mobile-nav">
            <Link href="/" className="brigid-login-home">
              <BrigidLogo />
              <span>Brigid</span>
            </Link>
            <Link href="/" className="brigid-login-back">
              Home
            </Link>
          </div>

          <h1>Sign in to Brigid</h1>
          <p className="brigid-login-subtitle">
            Use a simulation account to access your role workspace.
          </p>

          <form
            className="brigid-login-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="brigid-login-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@brigid.demo"
                disabled={submitting}
                required
              />
            </div>
            <div className="brigid-login-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                disabled={submitting}
                required
              />
            </div>

            {error && (
              <div className="brigid-login-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="brigid-login-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <section
            className="brigid-demo-section"
            aria-label="Quick demo accounts"
          >
            <h2 className="brigid-demo-title">Use demo account</h2>
            <div className="brigid-demo-grid">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  className="brigid-demo-btn"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    void submitCredentials(account.email, account.password);
                  }}
                >
                  <span>{account.label}</span>
                  <span>{account.role}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
