import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only audit view. Returns the recent AI-usage ledger across ALL orgs
 * (Higgsfield credits + Claude tokens, itemized) plus the platform-admin action
 * log (pricing/coupon/org config changes). requireAdmin-gated.
 *
 * Optional query: ?provider=higgsfield|claude, ?limit=1..200.
 */
function forbidden(e: unknown) {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  throw e;
}

export const GET = withErrors<unknown>(async (request) => {
  try {
    await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  const where = provider === "higgsfield" || provider === "claude" ? { provider } : {};

  const [events, actions, orgs, totals] = await Promise.all([
    prisma.usage_events.findMany({ where, orderBy: { created_at: "desc" }, take: limit }),
    prisma.audit_logs.findMany({ orderBy: { created_at: "desc" }, take: 60 }),
    prisma.organizations.findMany({ where: { deleted_at: null }, select: { id: true, name: true } }),
    prisma.usage_events.groupBy({ by: ["provider"], _sum: { credits: true, tokens: true }, _count: { _all: true } }),
  ]);

  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  const totalsByProvider = totals.reduce((acc, t) => {
    const s = t._sum as { credits: unknown; tokens: unknown };
    acc[t.provider] = {
      events: (t._count as { _all: number })._all,
      credits: Number(s.credits ?? 0),
      tokens: Number(s.tokens ?? 0),
    };
    return acc;
  }, {} as Record<string, { events: number; credits: number; tokens: number }>);

  return NextResponse.json({
    totals: {
      higgsfield: totalsByProvider.higgsfield ?? { events: 0, credits: 0, tokens: 0 },
      claude: totalsByProvider.claude ?? { events: 0, credits: 0, tokens: 0 },
    },
    events: events.map((e) => ({
      id: e.id, createdAt: e.created_at.toISOString(), org: orgName.get(e.org_id) ?? e.org_id.slice(0, 8),
      provider: e.provider, kind: e.kind, model: e.model, credits: Number(e.credits),
      tokens: Number(e.tokens), estimated: e.estimated, status: e.status,
    })),
    actions: actions.map((a) => ({
      id: a.id, createdAt: a.created_at.toISOString(), org: orgName.get(a.org_id) ?? a.org_id.slice(0, 8),
      action: a.action, resourceType: a.resource_type, changes: a.changes,
    })),
  });
});
