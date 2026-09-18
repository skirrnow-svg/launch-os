"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";

/**
 * Account settings. Two self-service lifecycle actions available to every user:
 *  • Deactivate — cancels recurring billing at cycle end and signs you out;
 *    data is kept and signing back in reactivates the account.
 *  • Delete — permanent: cancels billing now, removes your login and workspaces.
 * Changing or cancelling the plan itself lives on the Billing page.
 */
type Plan = { slug: string | null; name: string; status: string; cancelAtPeriodEnd?: boolean; periodEnd?: string };

export default function SettingsPage() {
  const { signOut } = useClerk();
  const [email, setEmail] = useState<string>("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState<"" | "deactivate" | "delete">("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => { setPlan(d.plan ?? null); setEmail(d.org?.name ?? ""); })
      .catch(() => {});
  }, []);

  async function deactivate() {
    if (!window.confirm(
      "Deactivate your account?\n\nThis cancels your subscription (at the end of the current period) and signs you out. Your workspace and data are kept — sign back in anytime to reactivate.",
    )) return;
    setBusy("deactivate"); setError("");
    try {
      const res = await fetch("/api/account/deactivate", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't deactivate.");
      await signOut({ redirectUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't deactivate.");
      setBusy("");
    }
  }

  async function del() {
    setBusy("delete"); setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't delete.");
      await signOut({ redirectUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setBusy("");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Account settings</h1>
      <p className="mt-1 text-slate-500">Manage your subscription and account.</p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* Subscription summary */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subscription</div>
        <div className="mt-1 text-lg font-bold">
          {plan?.slug ? plan.name : "Free plan"}
          {plan?.cancelAtPeriodEnd && (
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 align-middle">
              cancels at period end
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Change plans or cancel your subscription on the{" "}
          <Link href="/dashboard/billing" className="font-semibold text-indigo-600 hover:underline">Billing</Link> page.
          Cancelling stops future charges but keeps your plan until the period ends.
        </p>
      </div>

      {/* Danger zone */}
      <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-rose-500">Danger zone</div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-rose-100 pb-4">
          <div className="max-w-md">
            <div className="font-semibold text-slate-800">Deactivate account</div>
            <p className="mt-0.5 text-sm text-slate-500">
              Cancels billing and signs you out. Your data is kept — sign back in anytime to reactivate.
            </p>
          </div>
          <button
            type="button" onClick={deactivate} disabled={busy !== ""}
            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
          >
            {busy === "deactivate" ? "Deactivating…" : "Deactivate"}
          </button>
        </div>

        <div className="mt-4">
          <div className="font-semibold text-slate-800">Delete account permanently</div>
          <p className="mt-0.5 text-sm text-slate-500">
            Cancels your subscription, deletes your login, and removes your workspaces. This{" "}
            <span className="font-semibold">cannot be undone</span>. Type <code className="rounded bg-white px-1.5 py-0.5 text-rose-600">DELETE</code> to confirm.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
            />
            <button
              type="button" onClick={del} disabled={busy !== "" || confirmText !== "DELETE"}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
            >
              {busy === "delete" ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
