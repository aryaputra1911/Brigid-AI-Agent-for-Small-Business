"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import "./finance-pages.css";

export function ProfilePage() {
  const router = useRouter();
  const { user, role, info, requests, signOut } = useWorkspace();
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleSignOut() {
    setSigningOut(true);
    setNotice("");
    try {
      await signOut();
      router.push("/login");
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "Could not sign out. Please retry.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="paper-finance-page">
      <header className="paper-finance-heading">
        <span className="paper-finance-kicker">Account</span>
        <h1>Profile &amp; settings</h1>
        <p>
          Manage your active session, inspect your role permissions, or jump to
          spending mandate settings.
        </p>
      </header>

      <section className="brigid-detail-card" aria-label="Session details">
        <dl className="brigid-detail-grid">
          <div>
            <dt>Name</dt>
            <dd>{user?.name ?? "Simulation guest"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd style={{ textTransform: "capitalize" }}>
              {user?.role ?? (role || "connecting")}
            </dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{user?.user_id ?? "Not signed in"}</dd>
          </div>
          <div>
            <dt>Business ID</dt>
            <dd>{user?.business_id ?? "Demo business"}</dd>
          </div>
        </dl>

        {notice && (
          <div
            className="notice notice-error"
            role="alert"
            style={{ marginTop: 16 }}
          >
            {notice}
          </div>
        )}

        <div className="brigid-detail-actions">
          <Link href="/login" className="brigid-primary-link">
            {user ? "Switch account" : "Sign in"}
          </Link>
          {user && (
            <button
              type="button"
              className="paper-action paper-action-secondary"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          )}
        </div>
      </section>

      <section className="brigid-detail-card" aria-label="Workspace links">
        <dl className="brigid-detail-grid">
          <div>
            <dt>Spending mandate</dt>
            <dd>
              <Link href="/mandate" className="brigid-secondary-link">
                Open Mandate
              </Link>
            </dd>
          </div>
          <div>
            <dt>Pending approvals</dt>
            <dd>
              <Link href="/approvals" className="brigid-secondary-link">
                Open Approvals ({requests.length})
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section className="brigid-detail-card" aria-label="About Brigid">
        <dl className="brigid-detail-grid">
          <div>
            <dt>Environment</dt>
            <dd>
              {info?.simulation ||
                "Local simulation. Synthetic data, no real bank or real money."}
            </dd>
          </div>
          <div>
            <dt>Prompt screening</dt>
            <dd>{info?.screening_model ? "Active" : "Rule-based"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
