import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { BILLING_TIERS } from "@/lib/billing/plans";
import { effectiveTiers, getSignupOffer } from "@/lib/billing/pricing";
import { getBuilderThresholds } from "@/lib/billing/builderGate";
import { getActionCosts, FREE_ACTIONS } from "@/lib/billing/actionCosts";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Admin-only base pricing + signup-offer control.
 * GET   → effective tiers (defaults + overrides), the raw defaults, and the offer.
 * PATCH → { tier: { slug, priceInr?, creditsPerMonth? } } upserts a per-tier
 *         override (null/"" clears a field back to the code default);
 *         { offer: { welcomeCredits?, introDiscountPercent?, offerActive?, offerLabel? } }
 *         updates the singleton signup offer. Either or both may be present.
 */
const SLUGS = BILLING_TIERS.map((t) => t.slug) as string[];

function forbidden(e: unknown) {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  throw e;
}

function intOrNull(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined; // caller treats undefined as "leave as-is"
  return Math.round(n);
}

export const GET = withErrors<unknown>(async () => {
  try {
    await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const [tiers, offer, builderGate, actionCosts] = await Promise.all([
    effectiveTiers(),
    getSignupOffer(),
    getBuilderThresholds(),
    getActionCosts(),
  ]);
  return NextResponse.json({
    tiers: tiers.map((t) => ({ slug: t.slug, name: t.name, priceInr: t.priceInr, creditsPerMonth: t.creditsPerMonth, landingPages: t.landingPages })),
    defaults: BILLING_TIERS.map((t) => ({ slug: t.slug, name: t.name, priceInr: t.priceInr, creditsPerMonth: t.creditsPerMonth, landingPages: t.landingPages })),
    offer,
    // AI Video Prompt Builder unlock thresholds (by plan monthly credits).
    builderGate,
    // Per-action credit costs (one wallet, different burn rates) + free actions.
    actionCosts,
    freeActions: FREE_ACTIONS,
  });
});

export const PATCH = withErrors<unknown>(async (request) => {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let touched = false;

  // Per-tier price / credits override.
  const tier = body.tier as Record<string, unknown> | undefined;
  if (tier && typeof tier.slug === "string") {
    if (!SLUGS.includes(tier.slug)) {
      return NextResponse.json({ error: `Unknown tier "${tier.slug}".` }, { status: 400 });
    }
    const price = intOrNull(tier.priceInr);
    const credits = intOrNull(tier.creditsPerMonth);
    const landing = intOrNull(tier.landingPages);
    const data: { price_inr?: number | null; credits_per_month?: number | null; landing_pages?: number | null; updated_at: Date } = { updated_at: new Date() };
    if (price !== undefined) data.price_inr = price;
    if (credits !== undefined) data.credits_per_month = credits;
    if (landing !== undefined) data.landing_pages = landing;
    await prisma.pricing_overrides.upsert({
      where: { slug: tier.slug },
      update: data,
      create: { slug: tier.slug, price_inr: price ?? null, credits_per_month: credits ?? null, landing_pages: landing ?? null },
    });
    await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: "pricing.update", resourceType: "pricing", changes: { slug: tier.slug, priceInr: price, creditsPerMonth: credits, landingPages: landing } });
    touched = true;
  }

  // Signup offer.
  const offer = body.offer as Record<string, unknown> | undefined;
  if (offer) {
    const data: Record<string, unknown> = { updated_at: new Date() };
    const wc = intOrNull(offer.welcomeCredits);
    if (wc !== undefined && wc !== null) data.welcome_credits = wc;
    const idp = intOrNull(offer.introDiscountPercent);
    if (idp !== undefined && idp !== null) data.intro_discount_percent = Math.min(100, idp);
    if (typeof offer.offerActive === "boolean") data.offer_active = offer.offerActive;
    if ("offerLabel" in offer) data.offer_label = typeof offer.offerLabel === "string" ? offer.offerLabel.slice(0, 160) : null;
    await prisma.platform_settings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });
    await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: "offer.update", resourceType: "offer", changes: { ...offer } });
    touched = true;
  }

  // AI Video Prompt Builder unlock thresholds (by plan monthly credits).
  const builderGate = body.builderGate as Record<string, unknown> | undefined;
  if (builderGate) {
    const data: Record<string, unknown> = { updated_at: new Date() };
    const basic = intOrNull(builderGate.basicMinCredits);
    const advanced = intOrNull(builderGate.advancedMinCredits);
    if (basic !== undefined && basic !== null) data.builder_basic_min_credits = basic;
    if (advanced !== undefined && advanced !== null) data.builder_advanced_min_credits = advanced;
    if (Object.keys(data).length > 1) {
      await prisma.platform_settings.upsert({
        where: { id: "singleton" },
        update: data,
        create: { id: "singleton", ...data },
      });
      await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: "builderGate.update", resourceType: "builderGate", changes: { basic, advanced } });
      touched = true;
    }
  }

  // Per-action credit costs.
  const actionCosts = body.actionCosts as Record<string, unknown> | undefined;
  if (actionCosts) {
    const data: Record<string, unknown> = { updated_at: new Date() };
    const video = intOrNull(actionCosts.video);
    const image = intOrNull(actionCosts.image);
    const landing = intOrNull(actionCosts.landing);
    if (video !== undefined && video !== null) data.credit_cost_video = video;
    if (image !== undefined && image !== null) data.credit_cost_image = image;
    if (landing !== undefined && landing !== null) data.credit_cost_landing = landing;
    if (Object.keys(data).length > 1) {
      await prisma.platform_settings.upsert({
        where: { id: "singleton" },
        update: data,
        create: { id: "singleton", ...data },
      });
      await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: "actionCosts.update", resourceType: "actionCosts", changes: { video, image, landing } });
      touched = true;
    }
  }

  if (!touched) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const [tiers, updatedOffer, updatedGate, updatedCosts] = await Promise.all([
    effectiveTiers(),
    getSignupOffer(),
    getBuilderThresholds(),
    getActionCosts(),
  ]);
  return NextResponse.json({
    ok: true,
    tiers: tiers.map((t) => ({ slug: t.slug, name: t.name, priceInr: t.priceInr, creditsPerMonth: t.creditsPerMonth, landingPages: t.landingPages })),
    offer: updatedOffer,
    builderGate: updatedGate,
    actionCosts: updatedCosts,
  });
});
