"use client";

import { useEffect, useState } from "react";

/**
 * Usage — this workspace's own AI-usage ledger. Two axes metered separately:
 * Higgsfield credits (media) and Claude tokens (copy/audit). Available to every
 * account type; reads the org-scoped /api/usage.
 */
type Budget = { cap: number | null; used: number; remaining: number | null; events: number; source: "override" | "plan" | "free" };
type Event = { id: string; createdAt: string; provider: string; kind: string; model: string | null; credits: number; tokens: number; estimated: boolean; status: string };
type Plan = { slug: string | null; name: string; status: string; provider: string };
type PeriodInfo = { start: string; end: string; label: string };
type Data = { plan: Plan; period: PeriodInfo; credits: Budget; claude: Budget; events: Event[] };

const SRC_NOTE: Record<string, string> = { plan: "from plan", free: "free tier", override: "custom cap" };

const num = (n: number) => n.toLocaleString("en-IN");
const compact = (n: number) => Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const when = (s: string) => new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function UsagePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => { if (active) (d.error ? setError(d.error) : setData(d)); })
      .catch(() => active && setError("Couldn't load usage."));
    return () => { active = false; };
  }, []);

  if (error) return <div className="max-w-5xl"><p role="alert" className="rounded bg-red-50 px-4 py-3 text-sm text-danger">{error}</p></div>;
  if (!data) return <div className="max-w-5xl text-slate-500">Loading usage…</div>;

  return (
    <div className="max-w-5xl">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Telemetry</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Usage</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your workspace&apos;s AI spend for the current billing period, metered on two axes — Higgsfield credits for media
        and Claude tokens for copy &amp; audits. Allowances come from your plan and reset each cycle. Claude tokens are
        estimated (≈4 chars/token) until exact metering lands.
      </p>

      {/* Plan + period */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="rounded bg-blue-50 px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-accent">{data.plan.name} plan</span>
        <span className="text-slate-500">
          Billing period <span className="font-medium text-slate-700">{new Date(data.period.start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          {" – "}<span className="font-medium text-slate-700">{new Date(data.period.end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">resets {new Date(data.period.end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
      </div>

      {/* Budgets */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <BudgetCard title="Higgsfield credits" unit="credits" b={data.credits} fmt={num} />
        <BudgetCard title="Claude tokens" unit="tokens" b={data.claude} fmt={compact} />
      </div>

      {/* Ledger */}
      <div className="mt-6 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium text-right">Credits</th>
              <th className="px-4 py-3 font-medium text-right">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.events.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={6}>No usage yet. Media and copy generations will appear here.</td></tr>
            ) : data.events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{when(e.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${e.provider === "higgsfield" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{e.provider}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.kind}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{e.model ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{e.credits ? num(e.credits) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{e.tokens ? num(e.tokens) : "—"}{e.tokens && e.estimated ? "*" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">* estimated tokens</p>
    </div>
  );
}

function BudgetCard({ title, unit, b, fmt }: { title: string; unit: string; b: Budget; fmt: (n: number) => string }) {
  const pct = b.cap ? Math.min(100, Math.round((b.used / b.cap) * 100)) : 0;
  const note = SRC_NOTE[b.source];
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">{title}</p>
        <span className="text-sm tabular-nums text-slate-500">
          {b.cap == null ? `${fmt(b.used)} used (no cap)` : `${fmt(b.used)} / ${fmt(b.cap)}`}
        </span>
      </div>
      {b.cap != null && (
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded bg-slate-100">
          <div className={`h-full rounded ${pct > 85 ? "bg-danger" : pct > 60 ? "bg-warning" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        {b.events} {b.events === 1 ? "event" : "events"} · {b.cap == null ? "unlimited" : `${fmt(b.remaining ?? 0)} ${unit} left`}{note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}
