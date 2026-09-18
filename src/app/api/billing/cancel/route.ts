import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentPeriod } from "@/lib/billing/entitlements";
import { cancelSubscription } from "@/lib/billing/razorpay";

/**
 * POST /api/billing/cancel — cancel the org's recurring subscription.
 *
 * Cancels at Razorpay at the END of the current cycle (cancel_at_cycle_end), so
 * the workspace keeps its plan and credits until the period it already paid for
 * ends. We flag the local row cancel_at_period_end=true; the plan stays "active"
 * until Razorpay fires subscription.completed/cancelled at period end, which the
 * webhook then downgrades to free. Available to every user with a paid plan.
 */
export async function POST() {
  const { org } = await getContext();

  const sub = await prisma.subscriptions.findUnique({ where: { org_id: org.id } }).catch(() => null);
  if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
    return NextResponse.json({ error: "No active subscription to cancel." }, { status: 400 });
  }
  if (sub.cancel_at_period_end) {
    const end = currentPeriod(sub.anchor_at).end;
    return NextResponse.json({ ok: true, alreadyScheduled: true, accessUntil: end.toISOString() });
  }

  try {
    // Only reach Razorpay for a real Razorpay subscription; manual/admin ones
    // are cancelled locally.
    if (sub.provider === "razorpay" && sub.external_id) {
      await cancelSubscription(sub.external_id, true);
    }
    await prisma.subscriptions.update({
      where: { org_id: org.id },
      data: { cancel_at_period_end: true, updated_at: new Date() },
    });
    const end = currentPeriod(sub.anchor_at).end;
    return NextResponse.json({ ok: true, accessUntil: end.toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't cancel the subscription.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
