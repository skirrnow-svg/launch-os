"use client";

import { useEffect, useState } from "react";
import { BILLING_TIERS } from "@/lib/billing/plans";

/**
 * Billing / plans page.
 *
 * Renders the subscription tier catalog and the org's current credit allowance.
 * Tier prices/credits come from /api/public/pricing (code defaults + any
 * platform-admin overrides), falling back to the built-in catalog if that call
 * fails. The "Choose plan" CTA is intentionally INERT for now: checkout is wired
 * only once the Razorpay account is chosen and keys are configured.
 */
type Budget = { cap: number | null; used: number; remaining: number | null };
type Tier = {
  slug: string; name: string; priceInr: number; creditsPerMonth: number;
  approxVideosPerMonth: number; landingPages: number; tagline: string; features: string[];
};
type Offer = { offerLabel: string | null } | null;
type ActionCosts = { video: number; image: number };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

const FALLBACK_TIERS: Tier[] = BILLING_TIERS.map((t) => ({
  slug: t.slug, name: t.name, priceInr: t.priceInr, creditsPerMonth: t.creditsPerMonth,
  approxVideosPerMonth: t.approxVideosPerMonth, landingPages: t.landingPages, tagline: t.tagline, features: t.features,
}));

export default function BillingPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);
  const [offer, setOffer] = useState<Offer>(null);
  const [costs, setCosts] = useState<ActionCosts | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setBudget(d.budget ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    fetch("/api/public/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (Array.isArray(d.tiers) && d.tiers.length) setTiers(d.tiers);
        setOffer(d.offer ?? null);
        setCosts(d.actionCosts ?? null);
      })
      .catch(() => { /* keep fallback */ });
    return () => {
      active = false;
    };
  }, []);

  const cap = budget?.cap ?? null;
  const remaining = budget?.remaining ?? null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Plans &amp; billing</h1>
      <p className="text-slate-500 mt-1">
        Choose a monthly plan. Each plan sets how many sample concept videos your workspace can auto-produce.
      </p>
      {costs && (
        <p className="mt-1 text-sm text-slate-400">
          One shared credit pool — 1 video = {costs.video} credits, 1 image = {costs.image} credits. Ad copy
          and landing pages cost no credits.
        </p>
      )}

      {offer?.offerLabel && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700">
          <span aria-hidden>★</span>
          {offer.offerLabel}
        </div>
      )}

      {/* Current allowance */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current plan</div>
          <div className="text-lg font-bold mt-0.5">
            {!loaded ? "…" : cap == null ? "No active plan" : `${cap} credits / month`}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Credits remaining</div>
          <div className="text-lg font-bold mt-0.5 tabular-nums">
            {!loaded ? "…" : cap == null ? "—" : remaining}
          </div>
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.slug}
            className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col"
          >
            <div className="font-extrabold text-lg">{t.name}</div>
            <div className="text-sm text-slate-500 mt-0.5">{t.tagline}</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight">{inr(t.priceInr)}</span>
              <span className="text-slate-500 text-sm">/mo</span>
            </div>
            <div className="mt-1 text-sm font-medium text-indigo-600">
              {t.creditsPerMonth} credits · ~{t.approxVideosPerMonth} videos / mo
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              {t.landingPages} landing {t.landingPages === 1 ? "page" : "pages"}
            </div>
            <ul className="mt-4 flex-1 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-indigo-500 mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled
              title="Billing activates once payment setup is complete"
              className="mt-5 rounded-xl bg-slate-100 text-slate-400 font-semibold py-2.5 cursor-not-allowed border border-slate-200"
            >
              Choose {t.name}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Checkout activates once payment setup is finalized. Prices shown are the current plan catalog and may change.
      </p>
    </div>
  );
}
