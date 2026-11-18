"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Settings3, type SettingsRow } from "@/components/ui/settings-3";
import { Button } from "@/components/ui/button";
import "./finance-pages.css";

export function ProfilePage() {
  const router = useRouter();
  const { user, info, signOut } = useWorkspace();
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const rows = useMemo<SettingsRow[]>(
    () => [
      {
        key: "name",
        label: "Name",
        value: overrides.name ?? user?.name ?? "Simulation guest",
      },
      {
        key: "business_id",
        label: "Business ID",
        value: overrides.business_id ?? user?.business_id ?? "Demo business",
      },
      {
        key: "user_id",
        label: "User ID",
        value: overrides.user_id ?? user?.user_id ?? "Not signed in",
      },
      {
        key: "env",
        label: "Environment",
        value:
          overrides.env ??
          info?.simulation ??
          "Local simulation. Synthetic data, no real bank or real money.",
      },
    ],
    [overrides, user, info],
  );

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
        <h1>Profile</h1>
        <p>Inspect your active session details and environment.</p>
      </header>

      <Settings3
        title="Profile details"
        description="Edit one field at a time, in place."
        rows={rows}
        onSave={(key, value) =>
          setOverrides((prev) => ({ ...prev, [key]: value }))
        }
        footer={
          <div className="flex w-full flex-col gap-3">
            {notice && (
              <div className="notice notice-error" role="alert">
                {notice}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(211,231,241,0.1)_55%,rgba(255,255,255,0.06)_100%)] px-5 py-2.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(211,231,241,0.18),0_10px_24px_rgba(0,0,0,0.42)] backdrop-blur-xl backdrop-saturate-150 transition-all hover:border-[#d3e7f1]/60 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.3)_0%,rgba(211,231,241,0.18)_55%,rgba(255,255,255,0.1)_100%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1]"
              >
                {user ? "Switch account" : "Sign in"}
              </Link>
              {user && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </Button>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
