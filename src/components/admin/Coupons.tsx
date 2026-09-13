"use client";

import { useEffect, useState } from "react";

/**
 * Admin → Coupons. Create, list, activate/deactivate and delete discount codes.
 * Reads/writes /api/admin/coupons (requireAdmin-gated). Codes validate at
 * /api/public/coupon/validate; live redemption + money-off arrive with the
 * Razorpay gate (SN25), so redeemed counts stay at 0 until then.
 */
type Coupon = {
  id: string; code: string; kind: "percent" | "flat"; value: number; appliesTo: string;
  maxRedemptions: number | null; redeemedCount: number; expiresAt: string | null;
  active: boolean; createdAt: string;
};

const PLANS = [
  { slug: "starter", name: "Starter" },
  { slug: "growth", name: "Growth" },
  { slug: "scale", name: "Scale" },
];

export default function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // create form
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState<number>(10);
  const [appliesAll, setAppliesAll] = useState(true);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  async function load() {
    try {
      const res = await fetch("/api/admin/coupons");
      if (!res.ok) return;
      const d = await res.json();
      setCoupons(d.coupons ?? []);
    } catch { /* non-fatal */ }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, kind, value,
          appliesTo: appliesAll ? undefined : slugs,
          maxRedemptions: maxRedemptions || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Create failed.");
      setMsg(`Created ${code.toUpperCase()}.`);
      setCode(""); setValue(10); setAppliesAll(true); setSlugs([]); setMaxRedemptions(""); setExpiresAt("");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Create failed.");
    } finally { setBusy(false); }
  }

  async function toggle(c: Coupon) {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, active: !c.active }),
      });
      if (res.ok) setCoupons((prev) => prev?.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)) ?? prev);
    } catch { /* non-fatal */ }
  }

  async function remove(c: Coupon) {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      });
      if (res.ok) setCoupons((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
    } catch { /* non-fatal */ }
  }

  const fmtDiscount = (c: Coupon) => (c.kind === "percent" ? `${c.value}% off` : `₹${c.value.toLocaleString("en-IN")} off`);

  return (
    <section className="mt-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Coupons</p>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight">Discount codes</h2>
      <p className="mt-1 text-sm text-slate-500">
        Create codes customers can apply. Validation is live now; the discount is applied at checkout once payments are
        connected — until then redeemed counts stay at zero.
      </p>

      {msg && <p role="status" className="mt-4 rounded bg-blue-50 px-3 py-2 text-sm text-accent">{msg}</p>}

      {/* Create */}
      <div className="mt-5 rounded border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH20" maxLength={32}
              className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as "percent" | "flat")}
              className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none">
              <option value="percent">Percent (%)</option>
              <option value="flat">Flat (₹)</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{kind === "percent" ? "Percent off" : "Rupees off"}</label>
            <input type="number" min={1} max={kind === "percent" ? 100 : undefined} value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Max redemptions</label>
            <input type="number" min={1} value={maxRedemptions} placeholder="∞"
              onChange={(e) => setMaxRedemptions(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Expires</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
          </div>
          <div className="lg:col-span-3">
            <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Applies to</label>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={appliesAll} onChange={(e) => setAppliesAll(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" />
                All plans
              </label>
              {!appliesAll && PLANS.map((p) => (
                <label key={p.slug} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={slugs.includes(p.slug)}
                    onChange={(e) => setSlugs((prev) => e.target.checked ? [...prev, p.slug] : prev.filter((s) => s !== p.slug))}
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <button onClick={create} disabled={busy || !code}
          className="mt-4 rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
          {busy ? "Creating…" : "Create coupon"}
        </button>
      </div>

      {/* List */}
      <div className="mt-5 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Plans</th>
              <th className="px-4 py-3 font-medium">Used</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coupons == null ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={7}>Loading…</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={7}>No coupons yet.</td></tr>
            ) : coupons.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-medium text-slate-800">{c.code}</td>
                <td className="px-4 py-3 text-slate-700">{fmtDiscount(c)}</td>
                <td className="px-4 py-3 text-slate-500">{c.appliesTo === "all" ? "All" : c.appliesTo}</td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{c.redeemedCount}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}</td>
                <td className="px-4 py-3 text-slate-500">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${c.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.active ? "Active" : "Off"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => toggle(c)}
                      className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100">
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => remove(c)}
                      className="rounded border border-red-200 px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
