import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { effectiveTiers, getSignupOffer } from "@/lib/billing/pricing";

/**
 * POST /api/webhooks/razorpay — Razorpay event sink (SN25). SOURCE OF TRUTH for
 * paid state; never trust the browser for activation.
 *
 * Verifies x-razorpay-signature (HMAC-SHA256 over the RAW body) with
 * RAZORPAY_WEBHOOK_SECRET, then:
 *   subscription.activated / subscription.charged → activate the plan, set the
 *     org's monthly credit cap from the (admin-editable) effective tier, roll the
 *     billing period, and zero usage for the new cycle.
 *   subscription.halted / .cancelled / .completed → downgrade to free.
 *   order.paid → mid-cycle credit top-up (order notes carry org_id + credits).
 *
 * Always 200 on a *handled* or *ignored* event so Razorpay stops retrying;
 * 400 only on a bad signature.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Entity = { id?: string; plan_id?: string; status?: string; amount?: number; notes?: Record<string, string> };

async function activate(orgId: string, planSlug: string, subId: string | undefined, roll: boolean) {
  const tiers = await effectiveTiers();
  const tier = tiers.find((t) => t.slug === planSlug);
  if (!tier) return;

  await prisma.subscriptions.upsert({
    where: { org_id: orgId },
    update: {
      plan_slug: planSlug, status: "active", provider: "razorpay",
      external_id: subId, cancel_at_period_end: false, updated_at: new Date(),
      ...(roll ? { anchor_at: new Date() } : {}),
    },
    create: {
      org_id: orgId, plan_slug: planSlug, status: "active",
      provider: "razorpay", external_id: subId,
    },
  });

  // Set the cap from the plan; a fresh charge zeroes this cycle's usage.
  await prisma.organizations.update({
    where: { id: orgId },
    data: { plan: planSlug, credit_cap: tier.creditsPerMonth, ...(roll ? { credits_used: 0 } : {}) },
  });
}

async function downgrade(orgId: string) {
  const offer = await getSignupOffer();
  await prisma.subscriptions
    .update({ where: { org_id: orgId }, data: { status: "canceled", cancel_at_period_end: false, updated_at: new Date() } })
    .catch(() => null);
  await prisma.organizations
    .update({ where: { id: orgId }, data: { plan: "free", credit_cap: offer.welcomeCredits } })
    .catch(() => null);
}

/** Resolve our org id from a subscription entity's notes, or the local row. */
async function orgFromSubscription(sub: Entity): Promise<string | null> {
  const noted = sub.notes?.org_id;
  if (noted) return noted;
  if (sub.id) {
    const row = await prisma.subscriptions.findFirst({ where: { external_id: sub.id }, select: { org_id: true } });
    if (row) return row.org_id;
  }
  return null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let evt: { event?: string; payload?: Record<string, { entity?: Entity }> };
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ ok: true, ignored: "unparseable" }); }

  const event = evt.event ?? "";
  const sub = evt.payload?.subscription?.entity;
  const order = evt.payload?.order?.entity;

  try {
    switch (event) {
      case "subscription.activated":
      case "subscription.resumed": {
        if (sub) { const orgId = await orgFromSubscription(sub); const slug = sub.notes?.plan_slug;
          if (orgId && slug) await activate(orgId, slug, sub.id, false); }
        break;
      }
      case "subscription.charged": {
        if (sub) { const orgId = await orgFromSubscription(sub); const slug = sub.notes?.plan_slug;
          if (orgId && slug) await activate(orgId, slug, sub.id, true); }
        break;
      }
      case "subscription.halted":
      case "subscription.cancelled":
      case "subscription.completed": {
        if (sub) { const orgId = await orgFromSubscription(sub); if (orgId) await downgrade(orgId); }
        break;
      }
      case "order.paid": {
        // Mid-cycle top-up: order notes carry { org_id, credits }.
        const orgId = order?.notes?.org_id;
        const credits = Number(order?.notes?.credits ?? 0);
        if (orgId && credits > 0) {
          const org = await prisma.organizations.findUnique({ where: { id: orgId }, select: { credit_cap: true } });
          if (org && org.credit_cap != null) {
            await prisma.organizations.update({ where: { id: orgId }, data: { credit_cap: org.credit_cap + credits } });
          }
        }
        break;
      }
      default:
        return NextResponse.json({ ok: true, ignored: event });
    }
  } catch (e) {
    // Log-and-200 would hide failures; 500 lets Razorpay retry a transient error.
    const msg = e instanceof Error ? e.message : "handler error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event });
}
