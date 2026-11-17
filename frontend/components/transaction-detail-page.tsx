"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type TransactionDetailResult,
  brigidTransaction,
} from "@/lib/brigid-api";
import { FinanceState } from "@/components/finance-page-ui";
import "./finance-pages.css";

function formatAmount(
  amount: string | number,
  direction: "in" | "out",
): string {
  const num = typeof amount === "number" ? amount : Number(amount);
  const prefix = direction === "in" ? "+" : "-";
  if (!Number.isFinite(num)) return `${prefix}${amount}`;
  return `${prefix}${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TransactionDetailPage({ id }: { id: string }) {
  const [detail, setDetail] = useState<TransactionDetailResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const fetchDetail = useCallback(() => brigidTransaction(id), [id]);

  function reload() {
    setState("loading");
    setError("");
    void fetchDetail()
      .then((result) => {
        setDetail(result);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load transaction details.",
        );
        setState("error");
      });
  }

  useEffect(() => {
    let active = true;
    void fetchDetail()
      .then((result) => {
        if (!active) return;
        setDetail(result);
        setError("");
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not load transaction details.",
        );
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [fetchDetail]);

  const needsSignIn = error.toLowerCase().includes("sign in");

  return (
    <div className="paper-finance-page">
      <Link href="/transactions" className="brigid-back-link">
        Back to transactions
      </Link>

      {state === "loading" && (
        <FinanceState
          icon="rules"
          title="Loading transaction"
          description="Fetching transaction record."
        />
      )}

      {state === "error" && (
        <FinanceState
          icon="rules"
          tone="error"
          title={needsSignIn ? "Sign in required" : "Transaction unavailable"}
          description={
            needsSignIn
              ? "Sign in with an owner or bookkeeper demo account to inspect this transaction."
              : error
          }
        >
          {needsSignIn ? (
            <Link href="/login" className="brigid-primary-link">
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              className="paper-action paper-action-secondary"
              onClick={reload}
            >
              Retry
            </button>
          )}
        </FinanceState>
      )}

      {state === "ready" && detail && (
        <>
          <header className="paper-finance-heading">
            <span className="paper-finance-kicker">
              Ref {detail.transaction.reference}
            </span>
            <h1>{detail.transaction.counterparty}</h1>
            <div className="paper-finance-context">
              <span className="brigid-badge">
                {detail.transaction.direction === "in"
                  ? "Incoming"
                  : "Outgoing"}
              </span>
              {detail.transaction.needs_review && (
                <span className="brigid-badge brigid-badge-warn">
                  Needs review
                </span>
              )}
            </div>
          </header>

          <section
            className="brigid-detail-card"
            aria-label="Transaction details"
          >
            <dl className="brigid-detail-grid">
              <div>
                <dt>Amount</dt>
                <dd>
                  {formatAmount(
                    detail.transaction.amount,
                    detail.transaction.direction,
                  )}
                </dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{detail.transaction.date}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{detail.transaction.reference}</dd>
              </div>
              <div>
                <dt>Transaction ID</dt>
                <dd>{detail.transaction.id}</dd>
              </div>
            </dl>

            <div className="brigid-doc-box">
              {detail.transaction.memo || "No memo recorded."}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
