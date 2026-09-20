"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Admin · Visitors & Brand controls.
 *  - Daily free-funnel: anonymous → verified → signed up (from /api/admin/visitors).
 *  - Edit the Brand Studio per-creation AI-token cost (from /api/admin/brand-tokens).
 * Both endpoints are admin-gated; non-admins get "Admins only".
 */
type Day = { day: string; anonymous: number; verified: number; signedUp: number };
type Totals = { anonymous: number; verified: number; signedUp: number };
type VisitorData = { days: number; series: Day[]; totals: Totals };
type TokenCosts = { image: number; video: number; defaults: { image: number; video: number } };

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const num = (n: number) => n.toLocaleString("en-IN");

export default function AdminVisitorsPage() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<VisitorData | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setErr("");
    fetch(`/api/admin/visitors?days=${days}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch(() => setErr("Couldn't load visitors."));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Visitors &amp; Brand controls</h1>
        <p className="mt-1 text-sm text-slate-500">Daily reach across the free tools, and the token cost per Brand Studio creation.</p>
      </div>

      {/* Brand Studio token cost editor */}
      <BrandTokens />

      {/* Daily visitor funnel */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Daily visitors</h2>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="days" className="text-slate-500">Range</label>
            <select id="days" value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </div>

        {err && <p role="alert" className="mt-4 rounded bg-red-50 px-4 py-3 text-sm text-danger">{err}</p>}
        {!err && !data && <p className="mt-4 text-slate-500">Loading…</p>}

        {data && (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label="Anonymous visitors" value={data.totals.anonymous} sub={`hit a free tool · ${data.days}d`} tone="slate" />
              <Stat label="Verified (email pin)" value={data.totals.verified} sub={`passed verification · ${data.days}d`} tone="info" />
              <Stat label="Signed up" value={data.totals.signedUp} sub={`new accounts · ${data.days}d`} tone="accent" />
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-mono text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 font-medium">Day</th>
                    <th className="px-4 py-3 font-medium text-right">Anonymous</th>
                    <th className="px-4 py-3 font-medium text-right">Verified</th>
                    <th className="px-4 py-3 font-medium text-right">Signed up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.series.map((d) => (
                    <tr key={d.day}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{d.day}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{num(d.anonymous)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{num(d.verified)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{num(d.signedUp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Anonymous = distinct browsers that opened a free tool (counted once per tool per day). Verified = emails that
              passed the pin gate. Signed up = new accounts. The three stages are counted independently per day.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: "slate" | "info" | "accent" }) {
  const ring = tone === "accent" ? "border-accent/40" : tone === "info" ? "border-blue-200" : "border-slate-200";
  return (
    <div className={`${card} ${ring}`}>
      <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{num(value)}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function BrandTokens() {
  const [c, setC] = useState<TokenCosts | null>(null);
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/brand-tokens")
      .then((r) => r.json())
      .then((d) => { if (d.error) { setErr(d.error); return; } setC(d); setImage(String(d.image)); setVideo(String(d.video)); })
      .catch(() => setErr("Couldn't load token costs."));
  }, []);

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    try {
      const r = await fetch("/api/admin/brand-tokens", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: Number(image), video: Number(video) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed.");
      setC(d); setImage(String(d.image)); setVideo(String(d.video)); setMsg("Saved.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setSaving(false); }
  }

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-bold">Brand Studio — token cost per creation</h2>
      <p className="mt-1 text-sm text-slate-500">
        Notional SkirrNow AI tokens each branded download draws from the account&apos;s allowance. Free tier is 100k
        tokens — so at these costs, that&apos;s roughly {c ? Math.floor(100000 / Math.max(1, c.image)) : "…"} images or{" "}
        {c ? Math.floor(100000 / Math.max(1, c.video)) : "…"} videos per cycle.
      </p>
      {err && <p role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Image (tokens)</span>
          <input type="number" min={0} value={image} onChange={(e) => setImage(e.target.value)}
            className="w-32 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Video (tokens)</span>
          <input type="number" min={0} value={video} onChange={(e) => setVideo(e.target.value)}
            className="w-32 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums" />
        </label>
        <button type="button" onClick={save} disabled={saving}
          className="rounded bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-sm font-medium text-emerald-700">{msg}</span>}
        {c && <span className="text-xs text-slate-400">defaults: {c.defaults.image} / {c.defaults.video}</span>}
      </div>
    </section>
  );
}
