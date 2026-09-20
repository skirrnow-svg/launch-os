import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlement, periodUsage } from "@/lib/billing/entitlements";
import { recordUsage } from "@/lib/usage";
import { getCreationTokenCosts } from "@/lib/billing/creationCosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/brand/meter — meter one signed-in Brand Studio creation against the
 * account's SkirrNow AI-token allowance.
 *
 * Brand Studio branding is otherwise "unlimited", but every creation now draws
 * from the token pool so it's bounded by the plan. We compute remaining tokens
 * the same way the Usage page does (cap − used this period), and:
 *   - 402 { needsUpgrade } when the allowance is exhausted (client shows an
 *     upgrade prompt instead of downloading);
 *   - otherwise record the cost as a usage event (increments claude_tokens_used)
 *     and return what's left.
 * Unlimited plans (cap == null) are never blocked. Body: { media }.
 */
export const POST = withErrors<unknown>(async (request) => {
  const { user, org } = await getContext();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const media = body.media === "video" ? "video" : "image";
  const cost = (await getCreationTokenCosts())[media];

  const orgRow = await prisma.organizations.findUnique({
    where: { id: org.id },
    select: { id: true, credit_cap: true, claude_token_cap: true },
  });
  const ent = await getEntitlement(orgRow ?? { id: org.id, credit_cap: null, claude_token_cap: null });
  const used = await periodUsage(org.id, ent.period);
  const cap = ent.claude.cap;
  const remaining = cap == null ? null : Math.max(0, cap - used.tokens);

  if (remaining != null && remaining < cost) {
    return NextResponse.json(
      {
        error: "You've used your free SkirrNow AI tokens for this cycle. Upgrade for more.",
        needsUpgrade: true,
        remaining,
      },
      { status: 402 },
    );
  }

  await recordUsage({
    orgId: org.id,
    userId: user.id,
    provider: "claude",
    kind: `brand-${media}`,
    tokens: cost,
    estimated: true,
    status: "ok",
  });

  return NextResponse.json({ ok: true, cost, remaining: remaining == null ? null : remaining - cost });
});
