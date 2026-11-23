"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { hasStoredSession } from "@/lib/brigid-api";
import { CornerButton } from "./corner-button";
import { toAuthAwareHref } from "./landing-interactions";

export function FooterLauncher() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Enter a finance question to open in Chat.");
      return;
    }
    setError("");
    const target = `/chat?prompt=${encodeURIComponent(trimmed)}`;
    router.push(toAuthAwareHref(target, hasStoredSession()));
  };

  return (
    <form className="rre-footer-form" onSubmit={handleSubmit} noValidate>
      <div className="rre-footer-form__box">
        <div className="rre-footer-form__field">
          <label htmlFor="rre-footer-prompt" className="rre-footer-form__label">
            ASK BRIGID IN THE LOCAL SIMULATION
          </label>
          <input
            id="rre-footer-prompt"
            type="text"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (error) setError("");
            }}
            placeholder="e.g. Review overdue supplier invoices"
            className="rre-footer-form__input"
          />
        </div>
        <CornerButton type="submit" variant="light">
          OPEN CHAT
        </CornerButton>
      </div>
      {error && (
        <p className="rre-footer-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
