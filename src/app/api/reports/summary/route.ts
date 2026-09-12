import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET /api/reports/summary — the Analytics & Reporting agent's data feed.
 *
 * Org-scoped executive summary aggregated from the tables that already exist:
 * the lead funnel (by status + by source), campaign/asset status, and the
 * generation-credit budget. Read-only; no external calls, no credits. The
 * numbers drive the white-label dashboard at /dashboard/reports.
 */
type Counts = Record<string, number>;

const tally = (rows: Record<string, unknown>[], key: string): Counts =>
  rows.reduce((acc: Counts, r) => {
    const k = (r[key] as string) ?? "unknown";
    acc[k] = (acc[k] ?? 0) + ((r._count as { _all: number } | undefined)?._all ?? 0);
    return acc;
  }, {});

export const GET = withErrors<unknown>(async () => {
  const { org } = await getContext();
  const where = { org_id: org.id };

  const [leadByStatus, leadBySource, campaignByStatus, postByStatus, assetByStatus, recent, orgRow] =
    await Promise.all([
      prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ["source"], where, _count: { _all: true } }),
      prisma.email_campaigns.groupBy({
        by: ["status"],
        where: { projects: { org_id: org.id } },
        _count: { _all: true },
      }),
      prisma.social_posts.groupBy({
        by: ["status"],
        where: { projects: { org_id: org.id } },
        _count: { _all: true },
      }),
      prisma.assets.groupBy({
        by: ["status"],
        where: { projects: { org_id: org.id } },
        _count: { _all: true },
      }),
      prisma.lead.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: 8,
        select: { id: true, email: true, status: true, source: true, created_at: true },
      }),
      prisma.organizations.findUnique({
        where: { id: org.id },
        select: { name: true, credit_cap: true, credits_used: true },
      }),
    ]);

  const leads = tally(leadByStatus, "status");
  const totalLeads = Object.values(leads).reduce((a, b) => a + b, 0);
  const qualified = leads["QUALIFIED"] ?? 0;

  const cap = orgRow?.credit_cap ?? null;
  const used = Number(orgRow?.credits_used ?? 0);

  return NextResponse.json({
    org: { name: orgRow?.name ?? org.name ?? "Workspace" },
    leads: {
      total: totalLeads,
      byStatus: leads,
      bySource: tally(leadBySource, "source"),
      qualifiedRate: totalLeads ? Math.round((qualified / totalLeads) * 100) : 0,
    },
    campaigns: tally(campaignByStatus, "status"),
    posts: tally(postByStatus, "status"),
    assets: tally(assetByStatus, "status"),
    credits: { cap, used, remaining: cap == null ? null : Math.max(0, cap - used) },
    recent: recent.map((r) => ({ ...r, created_at: r.created_at })),
    generatedAt: new Date().toISOString(),
  });
});
