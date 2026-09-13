import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { effectiveTiers, getSignupOffer } from "@/lib/billing/pricing";

export const runtime = "nodejs";
// Must reflect live admin edits, so never statically cache this response.
export const dynamic = "force-dynamic";

/**
 * Public effective pricing + active signup offer, for client screens (the
 * in-app billing page and any storefront). Read-only, no auth, no secrets —
 * these are the same numbers shown on the marketing site.
 */
export const GET = withErrors<unknown>(async () => {
  const [tiers, offer] = await Promise.all([effectiveTiers(), getSignupOffer()]);
  return NextResponse.json({
    tiers: tiers.map((t) => ({
      slug: t.slug, name: t.name, priceInr: t.priceInr, amountPaise: t.amountPaise,
      creditsPerMonth: t.creditsPerMonth, approxVideosPerMonth: t.approxVideosPerMonth,
      tagline: t.tagline, features: t.features,
    })),
    // Only surface the offer to the public when it's actually switched on.
    offer: offer.offerActive ? offer : null,
  });
});
