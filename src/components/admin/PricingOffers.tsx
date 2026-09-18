"use client";

import { useEffect, useState } from "react";

/**
 * Admin → Pricing & offers. Lets the base provider edit each plan's base price
 * (₹/mo) and monthly credit allowance, and configure a signup offer banner.
 * Reads/writes /api/admin/pricing (requireAdmin-gated). Blank price/credits =
 * fall back to the built-in default for that tier.
 */
type Tier = { slug: string; name: string; priceInr: number; creditsPerMonth: number; landingPages: number };
type Offer = { welcomeCredits: number; introDiscountPercent: number; offerActive: boolean; offerLabel: string | null };
type BuilderGate = { basicMin: number; advancedMin: number };
type ActionCosts = { video: number; image: number; landing: number };
type FreeAction = { key: string; label: string; note: string };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function PricingOffers() {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [defaults, setDefaults] = useState<Tier[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [gate, setGate] = useState<BuilderGate | null>(null);
  const [costs, setCosts] = useState<ActionCosts | null>(null);
  const [freeActions, setFreeActions] = useState<FreeAction[]>([]);
  const [savingSlug, setSavingSlug] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);
  const [savingGate, setSavingGate] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/pricing");
      if (!res.ok) return;
      const d = await res.json();
      setTiers(d.tiers ?? []);
      setDefaults(d.defaults ?? []);
      setOffer(d.offer ?? null);
      setGate(d.builderGate ?? null);
      setCosts(d.actionCosts ?? null);
      setFreeActions(d.freeActions ?? []);
    } catch { /* non-fatal */ }
  }
  useEffect(() => { load(); }, []);

  function setTier(slug: string, patch: Partial<Tier>) {
    setTiers((prev) => prev?.map((t) => (t.slug === slug ? { ...t, ...patch } : t)) ?? prev);
  }

  async function saveTier(t: Tier) {
    setSavingSlug(t.slug); setMsg("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: { slug: t.slug, priceInr: t.priceInr, creditsPerMonth: t.creditsPerMonth, landingPages: t.landingPages } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed.");
      if (d.tiers) setTiers(d.tiers);
      setMsg(`Saved ${t.name} pricing.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    } finally { setSavingSlug(""); }
  }

  async function resetTier(slug: string) {
    const def = defaults.find((d) => d.slug === slug);
    if (!def) return;
    setTier(slug, { priceInr: def.priceInr, creditsPerMonth: def.creditsPerMonth, landingPages: def.landingPages });
    await saveTier({ ...def });
  }

  async function saveCosts() {
    if (!costs) return;
    setSavingCosts(true); setMsg("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionCosts: { video: costs.video, image: costs.image, landing: costs.landing } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed.");
      if (d.actionCosts) setCosts(d.actionCosts);
      setMsg("Saved per-action credit costs.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    } finally { setSavingCosts(false); }
  }

  async function saveGate() {
    if (!gate) return;
    setSavingGate(true); setMsg("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderGate: { basicMinCredits: gate.basicMin, advancedMinCredits: gate.advancedMin } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed.");
      if (d.builderGate) setGate(d.builderGate);
      setMsg("Saved builder access thresholds.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    } finally { setSavingGate(false); }
  }

  async function saveOffer() {
    if (!offer) return;
    setSavingOffer(true); setMsg("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed.");
      if (d.offer) setOffer(d.offer);
      setMsg("Saved signup offer.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    } finally { setSavingOffer(false); }
  }

  return (
    <section className="mt-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Pricing &amp; offers</p>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight">Base pricing</h2>
      <p className="mt-1 text-sm text-slate-500">
        Set each plan&apos;s monthly price and included credits. These drive the marketing pricing page and the in-app
        billing screen. Leave a field blank to use the built-in default.
      </p>

      {msg && <p role="status" className="mt-4 rounded bg-blue-50 px-3 py-2 text-sm text-accent">{msg}</p>}

      <div className="mt-5 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Price ₹/mo</th>
              <th className="px-4 py-3 font-medium">Credits/mo</th>
              <th className="px-4 py-3 font-medium">Landing pages</th>
              <th className="px-4 py-3 font-medium">Default</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tiers == null ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={6}>Loading…</td></tr>
            ) : tiers.map((t) => {
              const def = defaults.find((d) => d.slug === t.slug);
              return (
                <tr key={t.slug}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{t.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" min={0} value={t.priceInr}
                      onChange={(e) => setTier(t.slug, { priceInr: Number(e.target.value) })}
                      className="w-28 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" min={0} value={t.creditsPerMonth}
                      onChange={(e) => setTier(t.slug, { creditsPerMonth: Number(e.target.value) })}
                      className="w-24 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" min={0} value={t.landingPages}
                      onChange={(e) => setTier(t.slug, { landingPages: Number(e.target.value) })}
                      className="w-20 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
                    {def ? `${inr(def.priceInr)} · ${def.creditsPerMonth}cr · ${def.landingPages}pg` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => resetTier(t.slug)}
                        className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100">
                        Reset
                      </button>
                      <button onClick={() => saveTier(t)} disabled={savingSlug === t.slug}
                        className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
                        {savingSlug === t.slug ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-action credit costs */}
      <h3 className="mt-8 font-display text-lg font-bold tracking-tight">Per-action credit costs</h3>
      <p className="mt-1 text-sm text-slate-500">
        One shared credit wallet, different burn rates per action. Video is the <strong>base
        (minimum)</strong> cost of the cheapest clip (short, 480p); longer or higher-resolution clips
        cost more, and it is shown to customers as &ldquo;from ~N credits&rdquo;. Landing pages are
        <strong> included free</strong> up to each plan&apos;s page allowance (set above); EXTRA pages
        beyond that cost the landing rate (set it to 0 to keep the included quota as a hard cap). Ad
        copy costs no credits.
      </p>
      {costs && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Video — base (min) credits</label>
              <input type="number" min={0} value={costs.video}
                onChange={(e) => setCosts({ ...costs, video: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Image — credits / generation</label>
              <input type="number" min={0} value={costs.image}
                onChange={(e) => setCosts({ ...costs, image: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Landing — extra page credits</label>
              <input type="number" min={0} value={costs.landing}
                onChange={(e) => setCosts({ ...costs, landing: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
            </div>
          </div>
          {freeActions.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3">
              {freeActions.map((f) => (
                <li key={f.key} className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">0 credits</span>
                  <span className="font-medium text-slate-700">{f.label}</span>
                  <span className="text-slate-400">— {f.note}</span>
                </li>
              ))}
            </ul>
          )}
          <button onClick={saveCosts} disabled={savingCosts}
            className="mt-4 rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
            {savingCosts ? "Saving…" : "Save costs"}
          </button>
        </div>
      )}

      {/* Signup offer */}
      <h3 className="mt-8 font-display text-lg font-bold tracking-tight">Signup offer</h3>
      <p className="mt-1 text-sm text-slate-500">
        A promotional banner shown on the pricing page, plus optional welcome credits and an intro discount for new signups.
      </p>
      {offer && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={offer.offerActive}
              onChange={(e) => setOffer({ ...offer, offerActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" />
            Offer active (shows the banner publicly)
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Banner label</label>
              <input type="text" value={offer.offerLabel ?? ""} maxLength={160}
                placeholder="e.g. Launch offer — 20% off your first month"
                onChange={(e) => setOffer({ ...offer, offerLabel: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Welcome credits</label>
                <input type="number" min={0} value={offer.welcomeCredits}
                  onChange={(e) => setOffer({ ...offer, welcomeCredits: Number(e.target.value) })}
                  className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Intro discount %</label>
                <input type="number" min={0} max={100} value={offer.introDiscountPercent}
                  onChange={(e) => setOffer({ ...offer, introDiscountPercent: Number(e.target.value) })}
                  className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
              </div>
            </div>
          </div>
          <button onClick={saveOffer} disabled={savingOffer}
            className="mt-4 rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
            {savingOffer ? "Saving…" : "Save offer"}
          </button>
        </div>
      )}

      {/* AI Video Prompt Builder access thresholds */}
      <h3 className="mt-8 font-display text-lg font-bold tracking-tight">AI Video Prompt Builder access</h3>
      <p className="mt-1 text-sm text-slate-500">
        Gate the builder by a plan&apos;s monthly credit allowance. The guided (basic) path unlocks at the
        basic threshold; the Advanced pro controls unlock at the higher threshold. A workspace whose plan
        grants fewer credits sees the builder locked.
      </p>
      {gate && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Basic (guided) unlocks at ≥ credits/mo
              </label>
              <input type="number" min={0} value={gate.basicMin}
                onChange={(e) => setGate({ ...gate, basicMin: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Advanced controls unlock at ≥ credits/mo
              </label>
              <input type="number" min={0} value={gate.advancedMin}
                onChange={(e) => setGate({ ...gate, advancedMin: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none" />
            </div>
          </div>
          <button onClick={saveGate} disabled={savingGate}
            className="mt-4 rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
            {savingGate ? "Saving…" : "Save thresholds"}
          </button>
        </div>
      )}
    </section>
  );
}
