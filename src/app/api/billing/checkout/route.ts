import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLAN_SLUGS } from "@/lib/billing/entitlements";
import { razorpayPlanIdFor } from "@/lib/billing/plans";
import { createSubscription, razorpayConfigured, razorpayKeyId } from "@/lib/billing/razorpay";

/**
 * POST /api/billing/checkout — start a plan subscription.
 *
 * Body: { slug: "starter" | "growth" | "scale" }. Creates a Razorpay
 * subscription tagged with this org, records it locally as "created" (the
 * webhook flips it to "active" on payment), and returns the ids the browser
 * Checkout widget needs. The webhook — not this response — is the source of
 * truth for activation.
 */
export async function POST(request: Request) {
  const { user, org } = await getContext();

  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Payments aren't configured yet. Please try again shortly." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!PLAN_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const planId = razorpayPlanIdFor(slug);
  if (!planId) {
    return NextResponse.json({ error: `No Razorpay plan is configured for ${slug}.` }, { status: 503 });
  }

  try {
    const sub = await createSubscription({ planId, orgId: org.id, planSlug: slug });

    // Record locally as pending; entitlement stays free until the webhook
    // reports payment. org_id is unique, so a re-subscribe overwrites the row.
    await prisma.subscriptions.upsert({
      where: { org_id: org.id },
      update: { plan_slug: slug, status: "created", provider: "razorpay", external_id: sub.id, updated_at: new Date() },
      create: { org_id: org.id, plan_slug: slug, status: "created", provider: "razorpay", external_id: sub.id },
    });

    return NextResponse.json({
      subscriptionId: sub.id,
      keyId: razorpayKeyId(),
      planSlug: slug,
      prefill: { email: user.email, name: user.name ?? undefined },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't start checkout.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
