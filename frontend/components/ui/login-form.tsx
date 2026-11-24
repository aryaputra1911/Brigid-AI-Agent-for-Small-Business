"use client";

import { ChevronDown, Lock, Mail, User } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { PendingOAuthAccount, Role } from "@/lib/brigid-api";
import "./login-form.css";

export type AuthMode = "login" | "signup";
export type OAuthProvider = "google" | "github";

const SIGNUP_ROLES: Array<{
  value: Role;
  label: string;
  summary: string;
}> = [
  {
    value: "owner",
    label: "Owner",
    summary: "Full access: approvals, mandate, invoices, and transactions.",
  },
  {
    value: "bookkeeper",
    label: "Bookkeeper",
    summary: "Invoices and bank transactions (cannot draft mandate).",
  },
  {
    value: "staff",
    label: "Staff",
    summary: "Receivable invoices only.",
  },
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
  onOAuth?: (provider: OAuthProvider, mode: AuthMode) => void;
  error?: string;
  submitting?: boolean;
  oauthLoading?: OAuthProvider | null;
  className?: string;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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

function RoleHandIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 fill-current"
      viewBox="0 0 50 50"
      aria-hidden="true"
    >
      <path d="M 17 3 C 16.0625 3 15.117188 3.3125 14.34375 3.96875 C 13.570313 4.625 13 5.675781 13 6.90625 L 13 28.4375 C 12.558594 28.597656 12.15625 28.644531 11.34375 29.34375 C 10.167969 30.359375 9 32.183594 9 34.90625 C 9 36.878906 9.785156 38.683594 10.09375 39.40625 C 10.09375 39.417969 10.09375 39.425781 10.09375 39.4375 L 12.90625 45.03125 C 12.910156 45.039063 12.902344 45.054688 12.90625 45.0625 C 14.382813 48.105469 17.539063 50 20.90625 50 L 30 50 C 34.945313 50 39 45.945313 39 41 L 39 25 C 39 24.179688 38.871094 23.050781 38.3125 22 C 37.753906 20.949219 36.597656 20 35 20 C 33.90625 20 33.09375 20.375 32.4375 20.875 C 32.328125 20.574219 32.273438 20.238281 32.125 19.96875 C 31.503906 18.847656 30.367188 18 29 18 C 27.882813 18 27.007813 18.40625 26.34375 18.96875 C 25.679688 17.871094 24.558594 17 23 17 C 22.21875 17 21.574219 17.246094 21 17.59375 L 21 7 C 21 5.734375 20.460938 4.675781 19.6875 4 C 18.914063 3.324219 17.9375 3 17 3 Z M 17 5 C 17.460938 5 18 5.175781 18.375 5.5 C 18.75 5.824219 19 6.265625 19 7 L 19 23 L 21 23 L 21 21 C 21 20.125 21.660156 19 23 19 C 24.339844 19 25 20.125 25 21 L 25 22 C 25.007813 22.546875 25.453125 22.984375 26 22.984375 C 26.546875 22.984375 26.992188 22.546875 27 22 C 27 21.464844 27.132813 20.933594 27.40625 20.59375 C 27.679688 20.253906 28.082031 20 29 20 C 29.632813 20 29.996094 20.257813 30.375 20.9375 C 30.753906 21.617188 31 22.71875 31 24 L 33 24 C 33 23.417969 33.105469 22.910156 33.34375 22.59375 C 33.582031 22.277344 33.964844 22 35 22 C 35.902344 22 36.246094 22.339844 36.5625 22.9375 C 36.878906 23.535156 37 24.417969 37 25 L 37 41 C 37 44.855469 33.855469 48 30 48 L 20.90625 48 C 18.285156 48 15.816406 46.5 14.6875 44.15625 L 11.90625 38.59375 C 11.902344 38.585938 11.910156 38.570313 11.90625 38.5625 C 11.613281 37.875 11 36.320313 11 34.90625 C 11 32.726563 11.832031 31.585938 12.65625 30.875 C 13.480469 30.164063 14.25 29.96875 14.25 29.96875 C 14.691406 29.855469 15 29.457031 15 29 L 15 6.90625 C 15 6.238281 15.25 5.820313 15.625 5.5 C 16 5.179688 16.539063 5 17 5 Z M 21.90625 29.96875 C 21.863281 29.976563 21.820313 29.988281 21.78125 30 C 21.316406 30.105469 20.988281 30.523438 21 31 L 21 40 C 20.996094 40.359375 21.183594 40.695313 21.496094 40.878906 C 21.808594 41.058594 22.191406 41.058594 22.503906 40.878906 C 22.816406 40.695313 23.003906 40.359375 23 40 L 23 31 C 23.011719 30.710938 22.894531 30.433594 22.6875 30.238281 C 22.476563 30.039063 22.191406 29.941406 21.90625 29.96875 Z M 26.90625 29.96875 C 26.863281 29.976563 26.820313 29.988281 26.78125 30 C 26.316406 30.105469 25.988281 30.523438 26 31 L 26 40 C 25.996094 40.359375 26.183594 40.695313 26.496094 40.878906 C 26.808594 41.058594 27.191406 41.058594 27.503906 40.878906 C 27.816406 40.695313 28.003906 40.359375 28 40 L 28 31 C 28.011719 30.710938 27.894531 30.433594 27.6875 30.238281 C 27.476563 30.039063 27.191406 29.941406 26.90625 29.96875 Z M 31.90625 29.96875 C 31.863281 29.976563 31.820313 29.988281 31.78125 30 C 31.316406 30.105469 30.988281 30.523438 31 31 L 31 40 C 30.996094 40.359375 31.183594 40.695313 31.496094 40.878906 C 31.808594 41.058594 32.191406 41.058594 32.503906 40.878906 C 32.816406 40.695313 33.003906 40.359375 33 40 L 33 31 C 33.011719 30.710938 32.894531 30.433594 32.6875 30.238281 C 32.476563 30.039063 32.191406 29.941406 31.90625 29.96875 Z" />
    </svg>
  );
}

function RoleSelectField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Role | "";
  onChange: (role: Role) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = SIGNUP_ROLES.find((item) => item.value === value) ?? null;
  const listboxId = `${id}_listbox`;

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-20">
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="login-glass-input flex min-h-[44px] w-full cursor-pointer items-center justify-between border-0 border-b-2 border-white/35 bg-transparent py-2.5 px-0 text-left text-sm text-[#F1F7FF] focus:border-[#d3e7f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={`flex items-center gap-2 ${
            selected ? "text-[#F1F7FF]" : "text-[#F1F7FF]/75"
          }`}
        >
          <RoleHandIcon />
          <span>{selected ? selected.label : "Role"}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#F1F7FF]/75 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-white/20 bg-[#120b18]/95 py-1 shadow-xl backdrop-blur-xl"
        >
          {SIGNUP_ROLES.map((item) => {
            const isSelected = item.value === value;
            return (
              <li key={item.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className={`flex min-h-[44px] w-full cursor-pointer flex-col items-start justify-center px-3.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#d3e7f1] ${
                    isSelected
                      ? "bg-white/18 text-white"
                      : "text-[#F1F7FF]/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-[#F1F7FF]/70">
                    {item.summary}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <p className="mt-1.5 text-xs text-[#F1F7FF]/70">{selected.summary}</p>
      )}
    </div>
  );
}

/**
 * Role selection card shown to new Google/GitHub users right after OAuth verification.
 */
export function OAuthRoleStep({
  pending,
  onConfirm,
  onCancel,
  error = "",
  submitting = false,
  className = "",
}: {
  pending: PendingOAuthAccount;
  onConfirm: (role: Role) => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  error?: string;
  submitting?: boolean;
  className?: string;
}): React.JSX.Element {
  const [role, setRole] = useState<Role | "">("");
  const [localError, setLocalError] = useState("");
  const providerLabel = pending.provider === "google" ? "Google" : "GitHub";
  const activeError = localError || error;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) {
      setLocalError("Please select a role.");
      return;
    }
    setLocalError("");
    void onConfirm(role);
  }

  return (
    <div
      className={`login-glass-card w-full max-w-sm p-6 sm:p-8 space-y-6 rounded-2xl text-[#F1F7FF] ${className}`}
    >
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-[#F1F7FF]">
          {pending.provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
          <span>{providerLabel} verified</span>
        </div>
        <h1 className="text-2xl font-bold text-[#F1F7FF]">Choose Your Role</h1>
        <p className="text-sm text-[#F1F7FF]/80">
          Finish signing up as{" "}
          <span className="font-semibold text-white">{pending.name}</span> (
          {pending.email})
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <RoleSelectField
          id="oauth_signup_role"
          value={role}
          onChange={(nextRole) => {
            setRole(nextRole);
            setLocalError("");
          }}
          disabled={submitting}
        />

        {activeError && (
          <p
            id="login-error-text"
            role="alert"
            className="text-xs text-red-300"
          >
            {activeError}
          </p>
        )}

        <div className="space-y-2.5">
          <button
            type="submit"
            disabled={submitting}
            className="login-glass-btn w-full min-h-[44px] flex items-center justify-center py-3 px-4 rounded-lg text-[#F1F7FF] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
          >
            {submitting ? "Creating account..." : "Complete Sign Up"}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void onCancel()}
            className="login-oauth-btn flex min-h-[44px] w-full items-center justify-center rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-[#F1F7FF] hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
          >
            Use another account
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Glassmorphism-style authentication form supporting email/password sign-in,
 * account sign-up with role selection, and Google/GitHub OAuth.
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
  const [role, setRole] = useState<Role | "">("");
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
      if (!role) {
        setLocalError("Please select a role.");
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
        isSignup && role ? role : undefined,
      );
    }
  }

  function handleOAuth(provider: OAuthProvider) {
    if (busy) return;
    setLocalError("");
    onOAuth?.(provider, mode);
  }

  return (
    <div
      className={`login-glass-card w-full max-w-sm p-6 sm:p-8 space-y-6 rounded-2xl text-[#F1F7FF] ${className}`}
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#F1F7FF]">
          {isSignup ? "Create Account" : "Welcome Back"}
        </h1>
        <p className="mt-2 text-sm text-[#F1F7FF]/75">
          {isSignup ? "Sign up to start using Brigid" : "Sign in to continue"}
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
          <RoleSelectField
            id="signup_role"
            value={role}
            onChange={setRole}
            disabled={busy}
          />
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
          className="login-glass-btn w-full min-h-[44px] flex items-center justify-center py-3 px-4 rounded-lg text-[#F1F7FF] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
        >
          {submitting
            ? isSignup
              ? "Creating account..."
              : "Signing in..."
            : isSignup
              ? "Create Account"
              : "Sign In"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-[#F1F7FF]/60">
        <span className="h-px flex-1 bg-white/20" aria-hidden="true" />
        <span>or</span>
        <span className="h-px flex-1 bg-white/20" aria-hidden="true" />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => handleOAuth("google")}
          className="login-glass-btn flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-[#F1F7FF] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
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
          className="login-glass-btn flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-[#F1F7FF] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
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
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1.5 cursor-pointer font-semibold text-[#d3e7f1] underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSignup ? "Sign in" : "Sign up"}
        </button>
      </p>
    </div>
  );
}
