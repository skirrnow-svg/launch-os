/**
 * SkirrNow billing plan catalog — the single source of truth for subscription
 * tiers, pricing, and the per-org monthly credit allowance each tier grants.
 *
 * This module is deliberately ACCOUNT-AGNOSTIC and KEY-FREE: it does not import
 * a Razorpay client, read API keys, or hardcode any Razorpay plan id. The real
 * Razorpay Plan id for each tier is resolved at runtime from an env var
 * (see `razorpayPlanIdFor`), so the same catalog works whichever Razorpay
 * account is chosen later — nothing here commits to one.
 *
 * ── The hard constraint these numbers respect ──────────────────────────────
 * All media generation shares ONE pool of Higgsfield credits (default 200/mo,
 * HIGGSFIELD_MONTHLY_CAP). A sample concept video costs ~6 credits; copy is
 * free (subscription CLI). So `creditsPerMonth` is really "how many sample
 * videos this org can auto-produce per month", and the sum of all active orgs'
 * allowances should stay within the shared pool (raise the Higgsfield plan to
 * add capacity). Prices below are a STARTING PROPOSAL — edit freely; changing a
 * number here changes the plan everywhere in the app.
 */

export type BillingTier = {
  /** Stable internal slug — the app's key for the tier. */
  slug: "starter" | "growth" | "scale";
  name: string;
  /** Monthly price in whole rupees (for display). */
  priceInr: number;
  /** Monthly price in paise (what Razorpay expects when the Plan is created). */
  amountPaise: number;
  /** Per-org monthly Higgsfield credit allowance (sets organizations.credit_cap). */
  creditsPerMonth: number;
  /** Roughly how many sample concept videos that buys (~6 credits each). */
  approxVideosPerMonth: number;
  /** Env var holding this tier's Razorpay Plan id, resolved at runtime. */
  planIdEnvVar: string;
  tagline: string;
  features: string[];
};

/** ~Higgsfield credits per sample concept video (seedance_2_0, 480p/4s). */
export const CREDITS_PER_VIDEO = 6;

/**
 * Proposed tiers. Amounts are a starting point for owner approval, chosen so a
 * handful of customers fit within the default 200-credit/month shared pool.
 */
export const BILLING_TIERS: BillingTier[] = [
  {
    slug: "starter",
    name: "Starter",
    priceInr: 4999,
    amountPaise: 4999 * 100,
    creditsPerMonth: 30,
    approxVideosPerMonth: 5,
    planIdEnvVar: "RAZORPAY_PLAN_STARTER",
    tagline: "For solo operators testing the pipeline.",
    features: [
      "Full lead pipeline: qualify → verify → legal → sample copy",
      "~5 sample concept videos / month",
      "1-click approve gate",
      "Email support",
    ],
  },
  {
    slug: "growth",
    name: "Growth",
    priceInr: 12999,
    amountPaise: 12999 * 100,
    creditsPerMonth: 90,
    approxVideosPerMonth: 15,
    planIdEnvVar: "RAZORPAY_PLAN_GROWTH",
    tagline: "For an active agency running real inbound.",
    features: [
      "Everything in Starter",
      "~15 sample concept videos / month",
      "Priority support",
      "Own lead-intake funnel",
    ],
  },
  {
    slug: "scale",
    name: "Scale",
    priceInr: 24999,
    amountPaise: 24999 * 100,
    creditsPerMonth: 180,
    approxVideosPerMonth: 30,
    planIdEnvVar: "RAZORPAY_PLAN_SCALE",
    tagline: "For high-volume lead flow.",
    features: [
      "Everything in Growth",
      "~30 sample concept videos / month",
      "Dedicated support",
    ],
  },
];

/** Look up a tier by its internal slug. */
export function tierBySlug(slug: string): BillingTier | null {
  return BILLING_TIERS.find((t) => t.slug === slug) ?? null;
}

/**
 * Resolve the Razorpay Plan id for a tier from the environment (server-side).
 * Returns undefined when unset — the catalog never hardcodes a plan id, so the
 * account/keys can be decided later without touching this file. Key-free.
 */
export function razorpayPlanIdFor(slug: string): string | undefined {
  const tier = tierBySlug(slug);
  if (!tier) return undefined;
  const v = process.env[tier.planIdEnvVar];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Reverse map: given a Razorpay plan id (e.g. from a webhook), find which tier
 * it belongs to by matching the env-configured ids. Returns null if unmapped or
 * if no plan-id env vars are configured yet. Reads env only — no API keys.
 */
export function tierForRazorpayPlanId(planId: string): BillingTier | null {
  if (!planId) return null;
  return (
    BILLING_TIERS.find((t) => {
      const configured = process.env[t.planIdEnvVar];
      return configured && configured.trim() === planId;
    }) ?? null
  );
}
