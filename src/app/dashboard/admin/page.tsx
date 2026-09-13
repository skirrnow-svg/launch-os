"use client";

import { useEffect, useState } from "react";
import PricingOffers from "@/components/admin/PricingOffers";
import Coupons from "@/components/admin/Coupons";
import AuditLog from "@/components/admin/AuditLog";

/**
 * Admin → Organizations, Pricing & offers, Coupons. A platform-admin-only
 * console (the API enforces it via requireAdmin) that ordinary tenants never
 * see. Admins can set each org's account type — promoting one to "agency"
 * unlocks its white-label branding — adjust its monthly generation-credit cap,
 * edit base plan pricing, configure a signup offer, and manage discount codes.
 */
type Org = {
  id: string;
  name: string;
  slug: string;
  accountType: string;
  creditCap: number | null;
  creditsUsed: number;
  claudeTokenCap: number | null;
  claudeTokensUsed: number;
  claudeTokenDefault: number;
  branded: boolean;
};

const compact = (n: number) => Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const TYPES = ["solo", "sme", "agency"];

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/orgs");
      if (res.status === 403) { setForbidden(true); return; }
      const data = await res.json();
      if (res.ok) setOrgs(data.orgs ?? []);
    } catch { /* non-fatal */ }
  }
  useEffect(() => { load(); }, []);

  function setLocal(id: string, patch: Partial<Org>) {
    setOrgs((prev) => prev?.map((o) => (o.id === id ? { ...o, ...patch } : o)) ?? prev);
  }

  async function save(o: Org) {
    setSavingId(o.id); setMessage("");
    try {
      const res = await fetch("/api/admin/orgs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: o.id, accountType: o.accountType, creditCap: o.creditCap ?? "", claudeTokenCap: o.claudeTokenCap ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setMessage(`Saved ${o.name}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingId("");
    }
  }

  if (forbidden) {
    return (
      <div className="max-w-xl">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Admins only</h1>
        <p className="mt-2 text-sm text-slate-500">This console is restricted to platform administrators.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Admin</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Organizations</h1>
      <p className="mt-1 text-sm text-slate-500">
        Set each workspace&apos;s account type (agency unlocks white-label branding) and its monthly generation-credit
        cap. No API keys are needed — generation runs on the connected subscriptions.
      </p>

      {message && <p role="status" className="mt-4 rounded bg-blue-50 px-3 py-2 text-sm text-accent">{message}</p>}

      <div className="mt-6 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Credit cap</th>
              <th className="px-4 py-3 font-medium">Used</th>
              <th className="px-4 py-3 font-medium">Claude tokens</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orgs == null ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={6}>Loading…</td></tr>
            ) : orgs.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={6}>No organizations yet.</td></tr>
            ) : orgs.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{o.name}</div>
                  <div className="font-mono text-[11px] text-slate-400">{o.slug}{o.branded ? " · branded" : ""}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={o.accountType}
                    onChange={(e) => setLocal(o.id, { accountType: e.target.value })}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 focus:border-accent focus:outline-none"
                  >
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number" min={0}
                    value={o.creditCap ?? ""}
                    placeholder="∞"
                    onChange={(e) => setLocal(o.id, { creditCap: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-24 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{o.creditsUsed}</td>
                <td className="px-4 py-3">
                  <input
                    type="number" min={0}
                    value={o.claudeTokenCap ?? ""}
                    placeholder={compact(o.claudeTokenDefault)}
                    onChange={(e) => setLocal(o.id, { claudeTokenCap: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-28 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none"
                    title="Monthly Claude-token cap. Blank = plan default (shown)."
                  />
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{compact(o.claudeTokensUsed)} used</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => save(o)}
                    disabled={savingId === o.id}
                    className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {savingId === o.id ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PricingOffers />
      <Coupons />
      <AuditLog />
    </div>
  );
}
