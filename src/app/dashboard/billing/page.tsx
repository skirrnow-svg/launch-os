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
type ActionCosts = { video: number; image: number; landing: number };

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
  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    let active = true;
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setBudget(d.budget ?? null);
        setPlanSlug(d.plan?.slug ?? null);
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

  function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(false);
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  async function startCheckout(slug: string) {
    setNotice(""); setBusySlug(slug);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Couldn't load the payment window. Check your connection and retry.");
      const res = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start checkout.");

      const Rz = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      const rzp = new Rz({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "SkirrNow",
        description: `${slug.charAt(0).toUpperCase()}${slug.slice(1)} plan`,
        prefill: data.prefill ?? {},
        theme: { color: "#4f46e5" },
        handler: () => {
          // The webhook is the source of truth; poll /api/org until it flips.
          setNotice("Payment received — activating your plan…");
          let tries = 0;
          const iv = setInterval(async () => {
            tries += 1;
            try {
              const r = await fetch("/api/org");
              const d = await r.json();
              if (d.plan?.slug === slug || tries > 10) { clearInterval(iv); window.location.reload(); }
            } catch { if (tries > 10) { clearInterval(iv); window.location.reload(); } }
          }, 2000);
        },
        modal: { ondismiss: () => setBusySlug(null) },
      });
      rzp.open();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusySlug(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Plans &amp; billing</h1>
      <p className="text-slate-500 mt-1">
        Choose a monthly plan. Each plan sets how many sample concept videos your workspace can auto-produce.
      </p>
      {costs && (
        <p className="mt-1 text-sm text-slate-400">
          One shared credit pool — video from ~{costs.video} credits (rises with clip length, resolution and
          quality), image {costs.image} credits
          {costs.landing > 0
            ? `, and each landing page beyond your plan's included pages ${costs.landing} credits`
            : ""}
          . Ad copy is free.
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

      {/* Out of credits — surface the top-up path and per-action costs. */}
      {loaded && cap != null && remaining != null && remaining <= 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="font-semibold text-amber-900">You have used all your monthly credits</div>
          <p className="mt-1 text-sm text-amber-800">
            New video and image generation is paused until your next billing cycle. Ad copy is
            unaffected (free); landing pages within your plan&apos;s included quota still work, but
            extra paid pages are paused.
            {costs && (
              <> Each video costs from ~{costs.video} credits and each image {costs.image} credits.</>
            )}
          </p>
          <p className="mt-3 text-sm font-medium text-amber-900">
            Need more now? Move to a higher plan below for a larger monthly allowance.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            One-off credit top-ups activate once payment setup is complete; meanwhile your workspace
            admin can raise your monthly cap.
          </p>
        </div>
      )}

      {notice && (
        <p role="status" className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-700">
          {notice}
        </p>
      )}

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
              {t.creditsPerMonth} credits · up to ~{t.approxVideosPerMonth} short videos / mo
            </div>
            {costs && (
              <div className="mt-0.5 text-xs text-slate-500">
                Video from ~{costs.video} credits (more for longer / HD)
              </div>
            )}
            <div className="mt-0.5 text-sm text-slate-500">
              {t.landingPages} landing {t.landingPages === 1 ? "page" : "pages"}
              {costs && costs.landing > 0 ? ` included, then ~${costs.landing} credits each` : ""}
            </div>
            <ul className="mt-4 flex-1 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-indigo-500 mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {planSlug === t.slug ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-center font-semibold text-emerald-700">
                Current plan
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startCheckout(t.slug)}
                disabled={busySlug !== null}
                className="mt-5 rounded-xl bg-indigo-600 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {busySlug === t.slug ? "Starting…" : `Choose ${t.name}`}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Secure checkout by Razorpay. You can cancel anytime from your account. Prices shown are the current plan catalog and may change.
      </p>
    </div>
  );
}
