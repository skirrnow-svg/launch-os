import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { effectiveTiers, getSignupOffer } from "@/lib/billing/pricing";
import { getActionCosts } from "@/lib/billing/actionCosts";

export const runtime = "nodejs";
// Must reflect live admin edits, so never statically cache this response.
export const dynamic = "force-dynamic";

/**
 * Public effective pricing + active signup offer, for client screens (the
 * in-app billing page and any storefront). Read-only, no auth, no secrets —
 * these are the same numbers shown on the marketing site.
 */
export const GET = withErrors<unknown>(async () => {
  const [tiers, offer, actionCosts] = await Promise.all([
    effectiveTiers(),
    getSignupOffer(),
    getActionCosts(),
  ]);
  // Videos/month is DERIVED (plan credits ÷ current video cost), so the figure
  // shown to prospects tracks live pricing edits instead of a static number.
  const videosPerMonth = (credits: number) =>
    actionCosts.video > 0 ? Math.floor(credits / actionCosts.video) : 0;
  return NextResponse.json({
    tiers: tiers.map((t) => ({
      slug: t.slug, name: t.name, priceInr: t.priceInr, amountPaise: t.amountPaise,
      creditsPerMonth: t.creditsPerMonth,
      approxVideosPerMonth: videosPerMonth(t.creditsPerMonth),
      landingPages: t.landingPages, tagline: t.tagline, features: t.features,
    })),
    // Per-action credit costs, so cards can show "1 video = N credits".
    actionCosts,
    // Only surface the offer to the public when it's actually switched on.
    offer: offer.offerActive ? offer : null,
  });
});
