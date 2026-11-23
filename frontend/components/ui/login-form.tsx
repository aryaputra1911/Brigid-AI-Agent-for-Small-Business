"use client";

import { ArrowRight, ChevronDown, Lock, Mail, Shield, User } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { Role } from "@/lib/brigid-api";
import "./login-form.css";

export type AuthMode = "login" | "signup";
export type OAuthProvider = "google" | "github";

const SIGNUP_ROLES: Array<{ value: Role; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "bookkeeper", label: "Bookkeeper" },
  { value: "staff", label: "Staff" },
];

export interface LoginFormProps {
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  onSubmit?: (
    email: string,
    password: string,
    mode: AuthMode,
    name?: string,
    role?: Role,
  ) => Promise<void> | void;
  onOAuth?: (provider: OAuthProvider, mode: AuthMode, role?: Role) => void;
  error?: string;
  submitting?: boolean;
  oauthLoading?: OAuthProvider | null;
  className?: string;
}

function GoogleIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.92h5.46c-.24 1.26-.96 2.33-2.04 3.04l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.48 0-.72-.06-1.41-.19-2.04H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.75 0 5.06-.91 6.74-2.46l-3.3-2.56c-.91.61-2.08.98-3.44.98-2.64 0-4.88-1.78-5.68-4.18H2.91v2.63A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.32 13.78A6.01 6.01 0 0 1 6 12c0-.62.11-1.22.32-1.78V7.59H2.91A10 10 0 0 0 2 12c0 1.61.39 3.13.91 4.41l3.41-2.63Z"
      />
      <path
        fill="#4285F4"
        d="M12 6.04c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 2.99 14.74 2 12 2a10 10 0 0 0-9.09 5.59l3.41 2.63C7.12 7.82 9.36 6.04 12 6.04Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 fill-current"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.84c.85 0 1.71.11 2.51.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10Z" />
    </svg>
  );
}

/**
 * Glassmorphism-style authentication form supporting email/password sign-in,
 * account sign-up, and Google/GitHub OAuth.
 */
export function LoginForm({
  mode: controlledMode,
  onModeChange,
  onSubmit,
  onOAuth,
  error = "",
  submitting = false,
  oauthLoading = null,
  className = "",
}: LoginFormProps): React.JSX.Element {
  const [uncontrolledMode, setUncontrolledMode] = useState<AuthMode>("login");
  const mode = controlledMode ?? uncontrolledMode;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("owner");
  const [localError, setLocalError] = useState("");

  const activeError = localError || error;
  const busy = submitting || oauthLoading !== null;
  const isSignup = mode === "signup";

  function switchMode(nextMode: AuthMode) {
    if (busy || nextMode === mode) return;
    setLocalError("");
    if (onModeChange) {
      onModeChange(nextMode);
    } else {
      setUncontrolledMode(nextMode);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (isSignup) {
      if (!trimmedName) {
        setLocalError("Enter your full name.");
        return;
      }
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setLocalError("Enter a valid email address.");
        return;
      }
      if (password.length < 8) {
        setLocalError("Password must be at least 8 characters.");
        return;
      }
    } else if (!trimmedEmail || !password) {
      setLocalError("Enter both email and password.");
      return;
    }

    setLocalError("");
    if (onSubmit) {
      void onSubmit(
        trimmedEmail,
        password,
        mode,
        isSignup ? trimmedName : undefined,
        isSignup ? role : undefined,
      );
    }
  }

  function handleOAuth(provider: OAuthProvider) {
    if (busy) return;
    setLocalError("");
    onOAuth?.(provider, mode, isSignup ? role : undefined);
  }

  return (
    <div
      className={`login-glass-card w-full max-w-sm p-6 sm:p-8 space-y-6 rounded-2xl text-[#F1F7FF] ${className}`}
    >
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="grid grid-cols-2 gap-1 rounded-xl border border-white/15 bg-black/25 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          disabled={busy}
          onClick={() => switchMode("login")}
          className={`min-h-[44px] cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:cursor-not-allowed disabled:opacity-60 ${
            !isSignup
              ? "bg-white/18 text-[#F1F7FF]"
              : "text-[#F1F7FF]/70 hover:text-[#F1F7FF]"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          disabled={busy}
          onClick={() => switchMode("signup")}
          className={`min-h-[44px] cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:cursor-not-allowed disabled:opacity-60 ${
            isSignup
              ? "bg-white/18 text-[#F1F7FF]"
              : "text-[#F1F7FF]/70 hover:text-[#F1F7FF]"
          }`}
        >
          Sign Up
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#F1F7FF]">
          {isSignup ? "Create Account" : "Welcome Back"}
        </h1>
        <p className="mt-2 text-sm text-[#F1F7FF]/75">
          {isSignup
            ? "Sign up to start using Brigid"
            : "Sign in to continue"}
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {isSignup && (
          <div className="relative z-0">
            <input
              type="text"
              id="floating_name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              className="login-glass-input block py-2.5 px-0 w-full min-h-[44px] text-sm text-[#F1F7FF] bg-transparent border-0 border-b-2 border-white/35 appearance-none focus:border-[#d3e7f1] disabled:opacity-60 peer"
              placeholder=" "
              required
            />
            <label
              htmlFor="floating_name"
              className="pointer-events-none absolute text-sm text-[#F1F7FF]/75 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#d3e7f1] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
            >
              <User
                className="inline-block mr-2 -mt-1"
                size={16}
                aria-hidden="true"
              />
              Full Name
            </label>
          </div>
        )}

        {isSignup && (
          <div className="relative z-0">
            <label
              htmlFor="signup_role"
              className="mb-1.5 flex items-center text-xs text-[#F1F7FF]/75"
            >
              <Shield
                className="mr-2"
                size={15}
                aria-hidden="true"
              />
              Role
            </label>
            <div className="relative">
              <select
                id="signup_role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                disabled={busy}
                className="login-glass-input block min-h-[44px] w-full cursor-pointer appearance-none border-0 border-b-2 border-white/35 bg-transparent py-2.5 pr-8 text-sm text-[#F1F7FF] focus:border-[#d3e7f1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {SIGNUP_ROLES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                    className="bg-[#120b18] text-[#F1F7FF]"
                  >
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[#F1F7FF]/75"
                size={16}
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        <div className="relative z-0">
          <input
            type="email"
            id="floating_email"
            autoComplete={isSignup ? "email" : "username"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            className="login-glass-input block py-2.5 px-0 w-full min-h-[44px] text-sm text-[#F1F7FF] bg-transparent border-0 border-b-2 border-white/35 appearance-none focus:border-[#d3e7f1] disabled:opacity-60 peer"
            placeholder=" "
            required
          />
          <label
            htmlFor="floating_email"
            className="pointer-events-none absolute text-sm text-[#F1F7FF]/75 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#d3e7f1] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            <Mail
              className="inline-block mr-2 -mt-1"
              size={16}
              aria-hidden="true"
            />
            Email Address
          </label>
        </div>

        <div>
          <div className="relative z-0">
            <input
              type="password"
              id="floating_password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              aria-invalid={activeError ? true : undefined}
              aria-describedby={activeError ? "login-error-text" : undefined}
              className="login-glass-input block py-2.5 px-0 w-full min-h-[44px] text-sm text-[#F1F7FF] bg-transparent border-0 border-b-2 border-white/35 appearance-none focus:border-[#d3e7f1] disabled:opacity-60 peer"
              placeholder=" "
              required
            />
            <label
              htmlFor="floating_password"
              className="pointer-events-none absolute text-sm text-[#F1F7FF]/75 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#d3e7f1] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
            >
              <Lock
                className="inline-block mr-2 -mt-1"
                size={16}
                aria-hidden="true"
              />
              Password
            </label>
          </div>

          {isSignup && !activeError && (
            <p className="mt-2 text-xs text-[#F1F7FF]/70">
              Minimum 8 characters.
            </p>
          )}

          {activeError && (
            <p
              id="login-error-text"
              role="alert"
              className="mt-2 text-xs text-red-300"
            >
              {activeError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="login-glass-btn group w-full min-h-[44px] flex items-center justify-center py-3 px-4 rounded-lg text-[#F1F7FF] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
        >
          {submitting
            ? isSignup
              ? "Creating account..."
              : "Signing in..."
            : isSignup
              ? "Create Account"
              : "Sign In"}
          <ArrowRight
            className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform"
            aria-hidden="true"
          />
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-[#F1F7FF]/60">
        <span className="h-px flex-1 bg-white/20" aria-hidden="true" />
        <span>or</span>
        <span className="h-px flex-1 bg-white/20" aria-hidden="true" />
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => handleOAuth("google")}
          className="login-oauth-btn flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-[#F1F7FF] hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
        >
          <GoogleIcon />
          <span>
            {oauthLoading === "google"
              ? "Redirecting to Google..."
              : isSignup
                ? "Sign up with Google"
                : "Sign in with Google"}
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => handleOAuth("github")}
          className="login-oauth-btn flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-[#F1F7FF] hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
        >
          <GitHubIcon />
          <span>
            {oauthLoading === "github"
              ? "Redirecting to GitHub..."
              : isSignup
                ? "Sign up with GitHub"
                : "Sign in with GitHub"}
          </span>
        </button>
      </div>

      <p className="text-center text-xs text-[#F1F7FF]/75">
        {isSignup ? "Already have an account? " : "Need an account? "}
        <button
          type="button"
          disabled={busy}
          onClick={() => switchMode(isSignup ? "login" : "signup")}
          className="inline-flex min-h-[44px] items-center cursor-pointer font-semibold text-[#d3e7f1] underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSignup ? "Sign in" : "Sign up"}
        </button>
      </p>
    </div>
  );
}
