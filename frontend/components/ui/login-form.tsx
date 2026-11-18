"use client";

import { ArrowRight, Lock, User } from "lucide-react";
import type React from "react";
import { useState } from "react";
import "./login-form.css";

export interface LoginFormProps {
  onSubmit?: (email: string, password: string) => Promise<void> | void;
  error?: string;
  submitting?: boolean;
  className?: string;
}

/**
 * Glassmorphism-style login form with floating labels and Brigid sign-in integration.
 */
export function LoginForm({
  onSubmit,
  error = "",
  submitting = false,
  className = "",
}: LoginFormProps): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const activeError = error || localError;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError("Enter both email and password.");
      return;
    }
    setLocalError("");
    if (onSubmit) {
      void onSubmit(trimmedEmail, password);
    }
  }

  return (
    <div
      className={`login-glass-card w-full max-w-sm p-6 sm:p-8 space-y-6 rounded-2xl text-[#F1F7FF] ${className}`}
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#F1F7FF]">Welcome Back</h1>
        <p className="mt-2 text-sm text-[#F1F7FF]/75">Sign in to continue</p>
      </div>

      <form className="space-y-7" onSubmit={handleSubmit} noValidate>
        <div className="relative z-0">
          <input
            type="email"
            id="floating_email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            className="login-glass-input block py-2.5 px-0 w-full min-h-[44px] text-sm text-[#F1F7FF] bg-transparent border-0 border-b-2 border-white/35 appearance-none focus:border-[#d3e7f1] disabled:opacity-60 peer"
            placeholder=" "
            required
          />
          <label
            htmlFor="floating_email"
            className="pointer-events-none absolute text-sm text-[#F1F7FF]/75 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#d3e7f1] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            <User
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
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

          {activeError && (
            <p
              id="login-error-text"
              role="alert"
              className="mt-2 text-xs text-red-400"
            >
              {activeError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="login-glass-btn group w-full min-h-[44px] flex items-center justify-center py-3 px-4 rounded-lg text-[#F1F7FF] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign In"}
          <ArrowRight
            className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform"
            aria-hidden="true"
          />
        </button>
      </form>
    </div>
  );
}
