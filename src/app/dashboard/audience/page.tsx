"use client";

import { useRef, useState } from "react";

/**
 * Customer Analytics & Audience agent — RFM segmentation + churn.
 *
 * Upload/paste a customer CSV; the agent computes Recency/Frequency/Monetary
 * quintiles, maps each customer to a segment, and scores churn risk. Pure
 * client→API→compute round-trip (no credits, no persistence).
 */
type Segment = { segment: string; count: number; monetary: number; pct: number };
type Customer = {
  email: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  r: number;
  f: number;
  m: number;
  segment: string;
  churnRisk: "Low" | "Medium" | "High";
  churnScore: number;
};
type Result = {
  summary: {
    total: number;
    totalMonetary: number;
    avgMonetary: number;
    segments: Segment[];
    churn: { Low: number; Medium: number; High: number };
    warnings: string[];
  };
  customers: Customer[];
};

const SAMPLE_CSV = `email,last_order_date,orders,total_spent
ava@champions.co,2026-09-05,14,48200
liam@loyalbrand.in,2026-08-28,9,29800
noah@potential.io,2026-09-01,3,7400
mia@newbuyer.com,2026-09-08,1,1200
zoe@needsattention.co,2026-07-10,4,9100
raj@atrisk.in,2026-05-02,6,15600
sara@cantlose.com,2026-03-18,12,52100
omar@abouttosleep.co,2026-06-20,2,2600
neha@hibernating.in,2026-02-11,1,900
finn@lostcause.com,2025-11-03,1,450
elena@loyalist.io,2026-08-30,7,21300
dev@champions2.in,2026-09-06,11,39900`;

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

const SEGMENT_TONE: Record<string, string> = {
  Champions: "text-success",
  Loyal: "text-success",
  "Potential Loyalist": "text-accent",
  "New Customers": "text-accent",
  "Needs Attention": "text-warning",
  "About to Sleep": "text-warning",
  "At Risk": "text-danger",
  "Can't Lose Them": "text-danger",
  Hibernating: "text-slate-400",
  Lost: "text-slate-400",
};
const CHURN_TONE: Record<string, string> = { Low: "text-success", Medium: "text-warning", High: "text-danger" };

export default function AudiencePage() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
    setError("");
  }

  async function analyze() {
    if (!csv.trim()) { setError("Paste or upload a customer CSV first."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/audience/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't analyze that file.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const s = result?.summary;
  const maxSeg = s ? Math.max(...s.segments.map((x) => x.count), 1) : 1;

  return (
    <div className="max-w-5xl">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Customer Analytics &amp; Audience</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">RFM segmentation &amp; churn</h1>
      <p className="mt-1 text-slate-500">
        Upload a customer export and the agent scores every customer on Recency, Frequency and Monetary value,
        maps them to a segment, and flags churn risk. Nothing is stored.
      </p>

      {/* Input */}
      <div className="mt-6 rounded border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="aud-csv">
            Customer CSV
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setCsv(SAMPLE_CSV); setError(""); }}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Load sample data
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Upload .csv
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </div>
        </div>
        <textarea
          id="aud-csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={"email,last_order_date,orders,total_spent\njane@acme.com,2026-08-01,5,12400"}
          className="mt-3 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <p className="mt-2 text-xs text-slate-400">
          Columns are matched flexibly: <span className="font-mono">email</span>, a recency column
          (<span className="font-mono">last_order_date</span> or <span className="font-mono">recency_days</span>),
          <span className="font-mono"> orders</span>/frequency, and <span className="font-mono">total_spent</span>/monetary.
        </p>
        {error && <p role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          onClick={analyze}
          disabled={busy}
          className="mt-4 rounded bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Run segmentation"}
        </button>
      </div>

      {/* Results */}
      {s && (
        <div className="mt-6 space-y-6">
          {s.warnings.length > 0 && (
            <div className="rounded border border-warning/40 bg-amber-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-warning">Heads up:</span> {s.warnings.join(" ")}
            </div>
          )}

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Customers", s.total.toLocaleString("en-IN")],
              ["Total value", inr(s.totalMonetary)],
              ["Avg / customer", inr(s.avgMonetary)],
              ["High churn risk", `${s.churn.High} (${s.total ? Math.round((s.churn.High / s.total) * 100) : 0}%)`],
            ].map(([label, val]) => (
              <div key={label} className="rounded border border-slate-200 bg-white p-4">
                <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
                <div className="mt-1 font-display text-xl font-bold tabular-nums text-slate-900">{val}</div>
              </div>
            ))}
          </div>

          {/* Segment breakdown */}
          <div className="rounded border border-slate-200 bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-wider text-accent">Segments</p>
            <div className="mt-4 space-y-3">
              {s.segments.map((seg) => (
                <div key={seg.segment}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={`font-semibold ${SEGMENT_TONE[seg.segment] ?? "text-slate-900"}`}>{seg.segment}</span>
                    <span className="tabular-nums text-slate-500">
                      {seg.count} · {seg.pct}% · {inr(seg.monetary)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded bg-slate-100">
                    <div className="h-full rounded bg-accent" style={{ width: `${(seg.count / maxSeg) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer table */}
          <div className="rounded border border-slate-200 bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-wider text-accent">
              Customers <span className="text-slate-400">(first 100)</span>
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-mono text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-4 font-medium">Customer</th>
                    <th className="py-2 pr-4 font-medium">R</th>
                    <th className="py-2 pr-4 font-medium">F</th>
                    <th className="py-2 pr-4 font-medium">M</th>
                    <th className="py-2 pr-4 font-medium">Spend</th>
                    <th className="py-2 pr-4 font-medium">Segment</th>
                    <th className="py-2 font-medium">Churn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result!.customers.slice(0, 100).map((c) => (
                    <tr key={c.email}>
                      <td className="py-2 pr-4 text-slate-700">{c.email}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{c.r}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{c.f}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{c.m}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-600">{inr(c.monetary)}</td>
                      <td className={`py-2 pr-4 font-medium ${SEGMENT_TONE[c.segment] ?? "text-slate-700"}`}>{c.segment}</td>
                      <td className={`py-2 font-medium ${CHURN_TONE[c.churnRisk]}`}>
                        {c.churnRisk} <span className="text-slate-400">({c.churnScore})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
