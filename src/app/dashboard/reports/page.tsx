"use client";

import { useEffect, useState } from "react";

/**
 * Analytics & Reporting agent — a white-label executive dashboard.
 *
 * Reads the org-scoped summary from /api/reports/summary and renders the lead
 * funnel, sources, content pipeline and credit budget. Brand-neutral in the
 * body so an agency can show it to a client.
 */
type Summary = {
  org: { name: string };
  leads: { total: number; byStatus: Record<string, number>; bySource: Record<string, number>; qualifiedRate: number };
  campaigns: Record<string, number>;
  posts: Record<string, number>;
  assets: Record<string, number>;
  credits: { cap: number | null; used: number; remaining: number | null };
  recent: { id: string; email: string; status: string; source: string; created_at: string }[];
  generatedAt: string;
};

const FUNNEL_ORDER = ["PENDING", "PROCESSING", "QUALIFIED", "NEEDS_INFO", "REJECTED", "ERROR"];
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending", PROCESSING: "Processing", QUALIFIED: "Qualified",
  NEEDS_INFO: "Needs info", REJECTED: "Rejected", ERROR: "Error",
};
const STATUS_TONE: Record<string, string> = {
  QUALIFIED: "bg-success", PENDING: "bg-slate-400", PROCESSING: "bg-accent",
  NEEDS_INFO: "bg-warning", REJECTED: "bg-danger", ERROR: "bg-danger",
};
const SOURCE_LABEL: Record<string, string> = {
  inbound: "Inbound", pitch: "Instant Pitch", "free-generator": "Free generator", manual: "Manual",
};
const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

function sum(rec: Record<string, number>) {
  return Object.values(rec).reduce((a, b) => a + b, 0);
}

export default function ReportsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/reports/summary")
      .then((r) => r.json())
      .then((d) => { if (active) (d.error ? setError(d.error) : setData(d)); })
      .catch(() => active && setError("Couldn't load the report."));
    return () => { active = false; };
  }, []);

  if (error) return <div className="max-w-5xl"><p role="alert" className="rounded bg-red-50 px-4 py-3 text-sm text-danger">{error}</p></div>;
  if (!data) return <div className="max-w-5xl text-slate-500">Loading report…</div>;

  const maxFunnel = Math.max(...Object.values(data.leads.byStatus), 1);
  const creditsPct = data.credits.cap ? Math.min(100, Math.round((data.credits.used / data.credits.cap) * 100)) : 0;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Executive report</p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{data.org.name}</h1>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          As of {new Date(data.generatedAt).toLocaleString("en-IN")}
        </p>
      </div>

      {/* Headline tiles */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Total leads", String(data.leads.total)],
          ["Qualified rate", `${data.leads.qualifiedRate}%`],
          ["Campaigns", String(sum(data.campaigns) + sum(data.posts))],
          ["Credits used", data.credits.cap == null ? `${data.credits.used} (no cap)` : `${data.credits.used} / ${data.credits.cap}`],
        ].map(([label, val]) => (
          <div key={label} className="rounded border border-slate-200 bg-white p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">{val}</div>
          </div>
        ))}
      </div>

      {/* Lead funnel */}
      <div className="mt-6 rounded border border-slate-200 bg-white p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Lead funnel</p>
        {data.leads.total === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No leads yet. They&apos;ll appear here as the pipeline runs.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {FUNNEL_ORDER.filter((s) => data.leads.byStatus[s]).map((s) => (
              <div key={s}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-slate-700">{STATUS_LABEL[s] ?? pretty(s)}</span>
                  <span className="tabular-nums text-slate-500">{data.leads.byStatus[s]}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded bg-slate-100">
                  <div className={`h-full rounded ${STATUS_TONE[s] ?? "bg-accent"}`} style={{ width: `${(data.leads.byStatus[s] / maxFunnel) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Sources */}
        <div className="rounded border border-slate-200 bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Lead sources</p>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(data.leads.bySource).length === 0 && <li className="text-slate-500">—</li>}
            {Object.entries(data.leads.bySource).sort((a, b) => b[1] - a[1]).map(([src, n]) => (
              <li key={src} className="flex items-center justify-between">
                <span className="text-slate-700">{SOURCE_LABEL[src] ?? pretty(src)}</span>
                <span className="tabular-nums text-slate-500">{n}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Content pipeline */}
        <div className="rounded border border-slate-200 bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Content pipeline</p>
          <dl className="mt-4 space-y-2 text-sm">
            <StatusRow label="Email campaigns" rec={data.campaigns} />
            <StatusRow label="Social posts" rec={data.posts} />
            <StatusRow label="Media assets" rec={data.assets} />
          </dl>
        </div>
      </div>

      {/* Credit budget */}
      {data.credits.cap != null && (
        <div className="mt-6 rounded border border-slate-200 bg-white p-6">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-accent">Generation credits</p>
            <span className="text-sm tabular-nums text-slate-500">{data.credits.remaining} left of {data.credits.cap}</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded bg-slate-100">
            <div className={`h-full rounded ${creditsPct > 85 ? "bg-danger" : creditsPct > 60 ? "bg-warning" : "bg-accent"}`} style={{ width: `${creditsPct}%` }} />
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="mt-6 rounded border border-slate-200 bg-white p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Recent leads</p>
        {data.recent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {data.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span className="truncate text-slate-700">{r.email}</span>
                <span className="ml-3 flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-400">{SOURCE_LABEL[r.source] ?? pretty(r.source)}</span>
                  <span className="font-medium text-slate-600">{STATUS_LABEL[r.status] ?? pretty(r.status)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-slate-400">
        White-label ready · brand-neutral for client sharing
      </p>
    </div>
  );
}

function StatusRow({ label, rec }: { label: string; rec: Record<string, number> }) {
  const total = sum(rec);
  const parts = Object.entries(rec).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-700">{label}</dt>
      <dd className="text-right tabular-nums text-slate-500">
        {total === 0 ? "—" : parts.map(([k, n]) => `${n} ${pretty(k)}`).join(" · ")}
      </dd>
    </div>
  );
}
