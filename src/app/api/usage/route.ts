import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { getEntitlement, periodUsage } from "@/lib/billing/entitlements";
import { countFreeUses, FREE_AD_LIMIT } from "@/lib/free/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/usage — this workspace's own ledger + budgets for the CURRENT billing
 * period. Allowances come from the plan in use (entitlements); "used" is summed
 * from usage_events within the period, so it resets each billing cycle. Available
 * to every account type (org-scoped).
 */
export const GET = withErrors<unknown>(async () => {
  const { org } = await getContext();

  const orgRow = await prisma.organizations.findUnique({
    where: { id: org.id },
    select: { id: true, credit_cap: true, claude_token_cap: true },
  });
  const ent = await getEntitlement(orgRow ?? { id: org.id, credit_cap: null, claude_token_cap: null });
  const used = await periodUsage(org.id, ent.period);

  const [recent] = await Promise.all([
    prisma.usage_events.findMany({
      where: { org_id: org.id, created_at: { gte: ent.period.start, lt: ent.period.end } },
      orderBy: { created_at: "desc" }, take: 60,
    }),
  ]);

  const creditCap = ent.credits.cap;
  const tokenCap = ent.claude.cap;

  // Free Product-to-Ad audits used by this account's email (leads live in the
  // shared lead org, keyed by email — see /api/public/free/generate).
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  const leadOrg = process.env.DEFAULT_LEAD_ORG_ID;
  let freeAds: { used: number; limit: number; remaining: number } | null = null;
  if (email && leadOrg) {
    const usedAds = await countFreeUses(leadOrg, email, "free-generator");
    freeAds = { used: usedAds, limit: FREE_AD_LIMIT, remaining: Math.max(0, FREE_AD_LIMIT - usedAds) };
  }

  return NextResponse.json({
    freeAds,
    plan: { slug: ent.planSlug, name: ent.planName, status: ent.status, provider: ent.provider },
    period: { start: ent.period.start.toISOString(), end: ent.period.end.toISOString(), label: ent.periodLabel },
    credits: {
      cap: creditCap, used: used.credits,
      remaining: creditCap == null ? null : Math.max(0, creditCap - used.credits),
      events: used.creditEvents, source: ent.credits.source,
    },
    claude: {
      cap: tokenCap, used: used.tokens,
      remaining: tokenCap == null ? null : Math.max(0, tokenCap - used.tokens),
      events: used.tokenEvents, source: ent.claude.source,
    },
    events: recent.map((e) => ({
      id: e.id, createdAt: e.created_at.toISOString(), provider: e.provider, kind: e.kind,
      model: e.model, credits: Number(e.credits), tokens: Number(e.tokens), estimated: e.estimated, status: e.status,
    })),
  });
});
