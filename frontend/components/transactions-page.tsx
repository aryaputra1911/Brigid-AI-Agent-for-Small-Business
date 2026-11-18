"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type BankTransaction,
  type TransactionDirection,
  brigidTransactions,
} from "@/lib/brigid-api";
import { useWorkspace } from "@/components/workspace-provider";
import { FinanceState } from "@/components/finance-page-ui";
import { Bars } from "@/components/loading-ui/bars";
import "./finance-pages.css";

function formatAmount(
  amount: string | number,
  direction: TransactionDirection,
): string {
  const num = typeof amount === "number" ? amount : Number(amount);
  const prefix = direction === "in" ? "+" : "-";
  if (!Number.isFinite(num)) return `${prefix}${amount}`;
  return `${prefix}${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function periodStart(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function TransactionsPage() {
  const { user, role } = useWorkspace();
  const effectiveRole = user?.role ?? role;

  const [direction, setDirection] = useState<TransactionDirection | "">("");
  const [period, setPeriod] = useState<"30" | "90" | "365">("90");
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const fetchTransactions = useCallback(async () => {
    const from = periodStart(Number(period));
    const result = await brigidTransactions({ direction, from });
    return result.transactions;
  }, [direction, period]);

  function reload() {
    setState("loading");
    setError("");
    void fetchTransactions()
      .then((items) => {
        setTransactions(items);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Could not load transactions.",
        );
        setState("error");
      });
  }

  useEffect(() => {
    let active = true;
    void fetchTransactions()
      .then((items) => {
        if (!active) return;
        setTransactions(items);
        setError("");
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Could not load transactions.",
        );
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [fetchTransactions]);

  const needsSignIn = error.toLowerCase().includes("sign in");
  const isForbidden =
    error.toLowerCase().includes("only owner") ||
    error.toLowerCase().includes("access denied") ||
    effectiveRole === "staff";

  return (
    <div className="paper-finance-page">
      <header className="paper-finance-heading">
        <h1>Transactions</h1>
        <p>
          Inspect incoming and outgoing bank transactions. Open any entry to
          review its memo and reference.
        </p>
        <div className="paper-finance-context paper-finance-context-stack">
          <span>
            Role: <strong>{effectiveRole || "connecting"}</strong>
          </span>
          {state === "ready" && (
            <span>
              Number transactions: <strong>{transactions.length}</strong>
            </span>
          )}
        </div>
      </header>

      {state !== "loading" && (
        <div className="brigid-filter-bar" role="region" aria-label="Filters">
          <div className="brigid-filter-group">
            <label htmlFor="tx-direction-filter">Direction</label>
            <select
              id="tx-direction-filter"
              value={direction}
              onChange={(event) => {
                setState("loading");
                setDirection(event.target.value as TransactionDirection | "");
              }}
            >
              <option value="">All directions</option>
              <option value="in">Incoming (in)</option>
              <option value="out">Outgoing (out)</option>
            </select>
          </div>
          <div className="brigid-filter-group">
            <label htmlFor="tx-period-filter">Period</label>
            <select
              id="tx-period-filter"
              value={period}
              onChange={(event) => {
                setState("loading");
                setPeriod(event.target.value as "30" | "90" | "365");
              }}
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
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
          tone={isForbidden ? undefined : "error"}
          title={
            needsSignIn
              ? "Sign in required"
              : isForbidden
                ? "Restricted to owner or bookkeeper"
                : "Could not load transactions"
          }
          description={
            needsSignIn
              ? "Sign in with an owner or bookkeeper demo account to view bank transactions."
              : isForbidden
                ? "Staff accounts cannot view bank transactions. Switch to Owner or Bookkeeper in Login."
                : error
          }
        >
          {needsSignIn || isForbidden ? (
            <Link href="/login" className="brigid-primary-link">
              {needsSignIn ? "Sign in" : "Switch account"}
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

      {state === "ready" && transactions.length === 0 && (
        <FinanceState
          icon="rules"
          title="No matching transactions"
          description="Try expanding the period or clearing the direction filter."
        />
      )}

      {state === "ready" && transactions.length > 0 && (
        <ul className="brigid-list">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <Link
                href={`/transactions/${encodeURIComponent(tx.id)}`}
                className="brigid-list-card"
              >
                <div className="brigid-list-card-main">
                  <div className="brigid-list-card-title">
                    <span>{tx.counterparty}</span>
                    {tx.needs_review && (
                      <span className="text-sm font-normal text-amber-300">
                        | needs review
                      </span>
                    )}
                  </div>
                  <div className="brigid-list-card-meta">
                    <span>{tx.date}</span>
                    <span>Ref {tx.reference}</span>
                  </div>
                </div>
                <div className="brigid-list-card-amount">
                  <strong>{formatAmount(tx.amount, tx.direction)}</strong>
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
