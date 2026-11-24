"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type Invoice,
  type InvoiceKind,
  type InvoiceStatus,
  brigidInvoices,
} from "@/lib/brigid-api";
import { useWorkspace } from "@/components/workspace-provider";
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

export function InvoicesPage() {
  const { user, role } = useWorkspace();
  const effectiveRole = user?.role ?? role;
  const isStaff = effectiveRole === "staff";

  const [kind, setKind] = useState<InvoiceKind | "">("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const fetchInvoices = useCallback(async () => {
    const result = await brigidInvoices({
      kind: isStaff ? "receivable" : kind,
      status,
    });
    return result.invoices;
  }, [isStaff, kind, status]);

  function reload() {
    setState("loading");
    setError("");
    void fetchInvoices()
      .then((items) => {
        setInvoices(items);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Could not load invoices.",
        );
        setState("error");
      });
  }

  useEffect(() => {
    let active = true;
    void fetchInvoices()
      .then((items) => {
        if (!active) return;
        setInvoices(items);
        setError("");
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Could not load invoices.",
        );
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [fetchInvoices]);

  const needsSignIn = error.toLowerCase().includes("sign in");

  return (
    <div className="paper-finance-page">
      <header className="paper-finance-heading">
        <h1>Invoices</h1>
        <p>
          Review payable and receivable invoices. Open any invoice to inspect
          stated account details or ask Brigid to prepare a payment.
        </p>
        <div className="paper-finance-context paper-finance-context-stack">
          <span>
            Role: <strong>{effectiveRole || "connecting"}</strong>
          </span>
          {state === "ready" && (
            <span>
              Number invoices: <strong>{invoices.length}</strong>
            </span>
          )}
        </div>
      </header>

      {state !== "loading" && (
        <div className="brigid-filter-bar" role="region" aria-label="Filters">
          {!isStaff && (
            <div className="brigid-filter-group">
              <label htmlFor="invoice-kind-filter">Kind</label>
              <select
                id="invoice-kind-filter"
                value={kind}
                onChange={(event) => {
                  setState("loading");
                  setKind(event.target.value as InvoiceKind | "");
                }}
              >
                <option value="">All kinds</option>
                <option value="payable">Payable</option>
                <option value="receivable">Receivable</option>
              </select>
            </div>
          )}
          <div className="brigid-filter-group">
            <label htmlFor="invoice-status-filter">Status</label>
            <select
              id="invoice-status-filter"
              value={status}
              onChange={(event) => {
                setState("loading");
                setStatus(event.target.value as InvoiceStatus | "");
              }}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
        </div>
      )}

      {state === "loading" && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Bars className="h-6 w-6 text-white/75" />
        </div>
      )}

      {state === "error" && (
        <FinanceState
          icon="rules"
          tone="error"
          title={needsSignIn ? "Sign in required" : "Could not load invoices"}
          description={
            needsSignIn
              ? "Sign in with a demo account to view role-scoped invoices."
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

      {state === "ready" && invoices.length === 0 && (
        <FinanceState
          icon="rules"
          title="No matching invoices"
          description="Try clearing your filters to see other invoices."
        />
      )}

      {state === "ready" && invoices.length > 0 && (
        <ul className="brigid-list">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/invoices/${encodeURIComponent(invoice.id)}`}
                prefetch={false}
                className="brigid-list-card"
              >
                <div className="brigid-list-card-main">
                  <div className="brigid-list-card-title">
                    <span>{invoice.counterparty_name}</span>
                    {invoice.needs_review && (
                      <span className="brigid-badge brigid-badge-warn">
                        Needs review
                      </span>
                    )}
                  </div>
                  <div className="brigid-list-card-meta">
                    <span>#{invoice.number}</span>
                    <span>Due {invoice.due_date}</span>
                  </div>
                </div>
                <div className="brigid-list-card-amount">
                  <strong>
                    {formatAmount(invoice.amount, invoice.currency)}
                  </strong>
                  <span>View details</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
