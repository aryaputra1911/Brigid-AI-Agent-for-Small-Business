"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type InvoiceDetailResult, brigidInvoice } from "@/lib/brigid-api";
import { FinanceState } from "@/components/finance-page-ui";
import { Bars } from "@/components/loading-ui/bars";
import "./finance-pages.css";

function formatAmount(amount: string | number, currency: string): string {
  const num = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(num)) return `${amount} ${currency}`;
  return `${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function InvoiceDetailPage({ id }: { id: string }) {
  const [detail, setDetail] = useState<InvoiceDetailResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const fetchDetail = useCallback(() => brigidInvoice(id), [id]);

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
            : "Could not load invoice details.",
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
            : "Could not load invoice details.",
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
      <Link href="/invoices" className="brigid-back-link">
        Back to invoices
      </Link>

      {state === "loading" && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Bars className="h-6 w-6 text-white/75" />
        </div>
      )}

      {state === "error" && (
        <FinanceState
          icon="rules"
          tone="error"
          title={needsSignIn ? "Sign in required" : "Invoice unavailable"}
          description={
            needsSignIn
              ? "Sign in with a demo account to inspect this invoice."
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
              Invoice #{detail.invoice.number}
            </span>
            <h1>{detail.invoice.counterparty_name}</h1>
            <div className="paper-finance-context">
              <span className="brigid-badge">{detail.invoice.kind}</span>
              <span
                className={`brigid-badge ${
                  detail.invoice.status === "paid"
                    ? "brigid-badge-ok"
                    : detail.invoice.status === "void"
                      ? "brigid-badge-muted"
                      : ""
                }`}
              >
                {detail.invoice.status}
              </span>
              {detail.invoice.needs_review && (
                <span className="brigid-badge brigid-badge-warn">
                  Needs review
                </span>
              )}
            </div>
          </header>

          <section className="brigid-detail-card" aria-label="Invoice summary">
            <dl className="brigid-detail-grid">
              <div>
                <dt>Amount</dt>
                <dd>
                  {formatAmount(detail.invoice.amount, detail.invoice.currency)}
                </dd>
              </div>
              <div>
                <dt>Issue date</dt>
                <dd>{detail.invoice.issue_date}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{detail.invoice.due_date}</dd>
              </div>
              <div>
                <dt>Stated account</dt>
                <dd>{detail.invoice.stated_account ?? "None stated"}</dd>
              </div>
              <div>
                <dt>Late fee bearing</dt>
                <dd>{detail.invoice.late_fee_bearing ? "Yes" : "No"}</dd>
              </div>
            </dl>

            {detail.invoice.document_text && (
              <div className="brigid-doc-box">
                {detail.invoice.document_text}
              </div>
            )}
          </section>

          {detail.supplier && (
            <section
              className="brigid-detail-card"
              aria-label="Registered supplier"
            >
              <dl className="brigid-detail-grid">
                <div>
                  <dt>Registered supplier</dt>
                  <dd>{detail.supplier.name}</dd>
                </div>
                <div>
                  <dt>Account status</dt>
                  <dd>
                    {detail.supplier.account_verified
                      ? "Verified"
                      : "Unverified"}
                  </dd>
                </div>
                <div>
                  <dt>Verified account</dt>
                  <dd>{detail.supplier.verified_account ?? "None on file"}</dd>
                </div>
              </dl>
            </section>
          )}

          {detail.invoice.kind === "payable" &&
            detail.invoice.status === "open" && (
              <div className="brigid-detail-actions">
                <Link
                  href={`/chat?prompt=${encodeURIComponent(
                    `Pay invoice ${detail.invoice.number} (${detail.invoice.amount} ${detail.invoice.currency}) to ${detail.invoice.counterparty_name}.`,
                  )}`}
                  className="brigid-primary-link"
                >
                  Ask Brigid to pay
                </Link>
              </div>
            )}
        </>
      )}
    </div>
  );
}
