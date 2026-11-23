"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CornerButton } from "./corner-button";
import { toAuthAwareHref, useLandingSignedIn } from "./landing-interactions";

interface Scenario {
  prompt: string;
  label: string;
  routeLabel: string;
  href: string;
}

const scenarios: Scenario[] = [
  {
    prompt:
      '"Reconcile September bank feed entries against our books and flag any transaction that needs a closer look."',
    label: "Transaction reconciliation",
    routeLabel: "Chat workspace · Synthetic ledger",
    href: "/chat",
  },
  {
    prompt:
      '"Project our cash position over the next four weeks using verified ledger records and open supplier invoices."',
    label: "Cash-flow forecasting",
    routeLabel: "Chat workspace · Weekly projection",
    href: "/chat",
  },
  {
    prompt:
      '"Draft a supplier spending mandate with a $2,500 per-invoice ceiling and send it for owner review."',
    label: "Mandate drafting",
    routeLabel: "Mandate · Owner review required",
    href: "/mandate",
  },
  {
    prompt:
      '"Inspect pending payment requests, check policy warnings, and confirm or decline with an owner token."',
    label: "Out-of-band approvals",
    routeLabel: "Approvals · Human confirmation",
    href: "/approvals",
  },
];

export function RreScenarioSlider() {
  const [index, setIndex] = useState(0);
  const signedIn = useLandingSignedIn();
  const current = scenarios[index];

  const prev = () => {
    setIndex((curr) => (curr === 0 ? scenarios.length - 1 : curr - 1));
  };

  const next = () => {
    setIndex((curr) => (curr === scenarios.length - 1 ? 0 : curr + 1));
  };

  return (
    <div
      className="rre-slider"
      aria-roledescription="carousel"
      aria-label="Example workspace workflows"
    >
      <div className="rre-slider__controls-col">
        <div className="rre-slider__arrows">
          <button
            type="button"
            className="rre-arrow-btn"
            onClick={prev}
            aria-label="Previous workflow scenario"
          >
            <span className="rre-corner rre-corner--tl" aria-hidden="true" />
            <span className="rre-corner rre-corner--tr" aria-hidden="true" />
            <span className="rre-corner rre-corner--bl" aria-hidden="true" />
            <span className="rre-corner rre-corner--br" aria-hidden="true" />
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rre-arrow-btn"
            onClick={next}
            aria-label="Next workflow scenario"
          >
            <span className="rre-corner rre-corner--tl" aria-hidden="true" />
            <span className="rre-corner rre-corner--tr" aria-hidden="true" />
            <span className="rre-corner rre-corner--bl" aria-hidden="true" />
            <span className="rre-corner rre-corner--br" aria-hidden="true" />
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <p className="rre-slider__counter" aria-live="polite">
          0{index + 1} / 0{scenarios.length}
        </p>
      </div>

      <div className="rre-slider__content">
        <blockquote className="rre-slider__quote">{current.prompt}</blockquote>
        <div className="rre-slider__meta">
          <p className="rre-slider__author">{current.label}</p>
          <p className="rre-slider__role">{current.routeLabel}</p>
        </div>
        <div className="rre-slider__cta">
          <CornerButton
            href={toAuthAwareHref(current.href, signedIn)}
            variant="light"
          >
            TRY IN WORKSPACE
          </CornerButton>
        </div>
      </div>
    </div>
  );
}
