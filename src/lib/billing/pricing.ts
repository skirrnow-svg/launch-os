/**
 * Effective pricing + signup offer — the platform-admin overrides layered over
 * the hardcoded BILLING_TIERS catalog (src/lib/billing/plans.ts).
 *
 * BILLING_TIERS remains the source of truth for structure and DEFAULT numbers;
 * a `pricing_overrides` row (keyed by tier slug) replaces a tier's price and/or
 * monthly credits when set. Every read falls back to the code defaults if the DB
 * is unreachable, so the public pricing surfaces never break on a DB hiccup.
 *
 * SERVER-ONLY (imports the Prisma client). Client screens read these via
 * /api/public/pricing.
 */
import { prisma } from "@/lib/db";
import { BILLING_TIERS, type BillingTier } from "./plans";

export type SignupOffer = {
  welcomeCredits: number;
  introDiscountPercent: number;
  offerActive: boolean;
  offerLabel: string | null;
};

export const DEFAULT_OFFER: SignupOffer = {
  welcomeCredits: 0,
  introDiscountPercent: 0,
  offerActive: false,
  offerLabel: null,
};

/** BILLING_TIERS with any per-tier DB overrides applied. Falls back to defaults. */
export async function effectiveTiers(): Promise<BillingTier[]> {
  try {
    const overrides = await prisma.pricing_overrides.findMany();
    const bySlug = new Map(overrides.map((o) => [o.slug, o]));
    return BILLING_TIERS.map((t) => {
      const o = bySlug.get(t.slug);
      if (!o) return t;
      const priceInr = o.price_inr ?? t.priceInr;
      const creditsPerMonth = o.credits_per_month ?? t.creditsPerMonth;
      const landingPages = o.landing_pages ?? t.landingPages;
      return { ...t, priceInr, amountPaise: priceInr * 100, creditsPerMonth, landingPages };
    });
  } catch {
    return BILLING_TIERS;
  }
}

/**
 * The effective landing-page allowance for a plan slug (admin override → code
 * default). Used by the landing quota so an admin edit takes effect. Returns
 * null for an unknown/absent slug (caller falls back to the account-type quota).
 */
export async function effectiveLandingPagesForPlan(slug: string | null | undefined): Promise<number | null> {
  if (!slug) return null;
  const tiers = await effectiveTiers();
  const t = tiers.find((x) => x.slug === slug);
  return t ? t.landingPages : null;
}

/** The current signup offer, or the inert default if unset / DB unreachable. */
export async function getSignupOffer(): Promise<SignupOffer> {
  try {
    const s = await prisma.platform_settings.findUnique({ where: { id: "singleton" } });
    if (!s) return DEFAULT_OFFER;
    return {
      welcomeCredits: s.welcome_credits ?? 0,
      introDiscountPercent: s.intro_discount_percent ?? 0,
      offerActive: s.offer_active ?? false,
      offerLabel: s.offer_label?.trim() || null,
    };
  } catch {
    return DEFAULT_OFFER;
  }
}
