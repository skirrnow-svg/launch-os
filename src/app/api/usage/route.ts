import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { claudeTokensForAccountType } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/usage — this workspace's own AI-usage ledger + budgets. Available to
 * every account type (org-scoped via getContext). Two axes: Higgsfield credits
 * (media) and Claude tokens (copy/audit), each with its cap.
 */
export const GET = withErrors<unknown>(async () => {
  const { org } = await getContext();

  const [events, totals, orgRow] = await Promise.all([
    prisma.usage_events.findMany({ where: { org_id: org.id }, orderBy: { created_at: "desc" }, take: 60 }),
    prisma.usage_events.groupBy({ by: ["provider"], where: { org_id: org.id }, _sum: { credits: true, tokens: true }, _count: { _all: true } }),
    prisma.organizations.findUnique({
      where: { id: org.id },
      select: { account_type: true, credit_cap: true, credits_used: true, claude_token_cap: true, claude_tokens_used: true },
    }),
  ]);

  const byProvider = totals.reduce((acc, t) => {
    const s = t._sum as { credits: unknown; tokens: unknown };
    acc[t.provider] = { events: (t._count as { _all: number })._all, credits: Number(s.credits ?? 0), tokens: Number(s.tokens ?? 0) };
    return acc;
  }, {} as Record<string, { events: number; credits: number; tokens: number }>);

  const creditCap = orgRow?.credit_cap ?? null;
  const creditsUsed = Number(orgRow?.credits_used ?? 0);
  const tokenCap = orgRow?.claude_token_cap == null ? claudeTokensForAccountType(orgRow?.account_type) : Number(orgRow.claude_token_cap);
  const tokensUsed = Number(orgRow?.claude_tokens_used ?? 0);

  return NextResponse.json({
    credits: { cap: creditCap, used: creditsUsed, remaining: creditCap == null ? null : Math.max(0, creditCap - creditsUsed), events: byProvider.higgsfield?.events ?? 0 },
    claude: { cap: tokenCap, used: tokensUsed, remaining: tokenCap == null ? null : Math.max(0, tokenCap - tokensUsed), events: byProvider.claude?.events ?? 0, capIsDefault: orgRow?.claude_token_cap == null },
    events: events.map((e) => ({
      id: e.id, createdAt: e.created_at.toISOString(), provider: e.provider, kind: e.kind,
      model: e.model, credits: Number(e.credits), tokens: Number(e.tokens), estimated: e.estimated, status: e.status,
    })),
  });
});
