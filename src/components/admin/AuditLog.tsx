"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Admin → Audit log. The itemized AI-usage ledger across all workspaces
 * (Higgsfield credits + Claude tokens, metered separately) plus the platform
 * admin-action trail. Reads /api/admin/audit (requireAdmin-gated).
 */
type UsageEvent = {
  id: string; createdAt: string; org: string; provider: string; kind: string;
  model: string | null; credits: number; tokens: number; estimated: boolean; status: string;
};
type Action = { id: string; createdAt: string; org: string; action: string; resourceType: string; changes: unknown };
type Totals = { higgsfield: { events: number; credits: number; tokens: number }; claude: { events: number; credits: number; tokens: number } };

const num = (n: number) => n.toLocaleString("en-IN");
const compact = (n: number) => Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const when = (s: string) => new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
// Customer-facing label for the media provider (internal id stays "higgsfield").
const providerLabel = (p: string) => (p === "higgsfield" ? "Graphics, Video & Web" : p === "claude" ? "Claude" : p);

export default function AuditLog() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [filter, setFilter] = useState<"all" | "higgsfield" | "claude">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `?provider=${filter}`;
      const res = await fetch(`/api/admin/audit${q}`);
      if (!res.ok) return;
      const d = await res.json();
      setTotals(d.totals ?? null);
      setEvents(d.events ?? []);
      setActions(d.actions ?? []);
    } catch { /* non-fatal */ } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="mt-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Telemetry</p>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight">Audit log</h2>
      <p className="mt-1 text-sm text-slate-500">
        Every AI generation across all workspaces, metered on two axes — Graphics, Video &amp; Web credits (media) and
        Claude tokens (copy/audit) — plus the platform admin-action trail. Claude token counts are estimated
        (≈4 chars/token) until exact metering lands.
      </p>

      {/* Totals */}
      {totals && (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Tile label="Graphics, Video & Web credits" value={num(totals.higgsfield.credits)} sub={`${num(totals.higgsfield.events)} events`} />
          <Tile label="Claude tokens" value={compact(totals.claude.tokens)} sub={`${num(totals.claude.events)} calls`} />
          <Tile label="Media generations" value={num(totals.higgsfield.events)} sub="images · videos · sites" />
          <Tile label="Copy generations" value={num(totals.claude.events)} sub="briefs · copy · audits" />
        </div>
      )}

      {/* Filter */}
      <div className="mt-6 flex items-center gap-2">
        {(["all", "higgsfield", "claude"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f ? "bg-accent text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"}`}>
            {f === "all" ? "All providers" : f === "higgsfield" ? "Graphics, Video & Web" : "Claude"}
          </button>
        ))}
      </div>

      {/* Usage ledger */}
      <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium text-right">Credits</th>
              <th className="px-4 py-3 font-medium text-right">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={7}>Loading…</td></tr>
            ) : events.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={7}>No usage recorded yet. Generations will appear here as they run.</td></tr>
            ) : events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{when(e.createdAt)}</td>
                <td className="px-4 py-3 text-slate-700">{e.org}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${e.provider === "higgsfield" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {providerLabel(e.provider)}
                  </span>
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

      {/* Admin actions */}
      <h3 className="mt-8 font-display text-lg font-bold tracking-tight">Admin actions</h3>
      <div className="mt-3 rounded border border-slate-200 bg-white">
        {actions.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No admin config changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{a.action}</span>
                  <span className="text-slate-500">{a.changes ? JSON.stringify(a.changes) : a.resourceType}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">{when(a.createdAt)} · {a.org}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
    </div>
  );
}
