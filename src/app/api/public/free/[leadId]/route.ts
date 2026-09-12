import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/public/free/:leadId — poll the free-generator result.
 *
 * PUBLIC, but only ever returns a lead whose source is 'free-generator', and
 * only the generated report (hooks + audit) — never other tenant data. The id
 * is an unguessable UUID the visitor just received for their own submission.
 */
type FreeReport = {
  business?: { name?: string; what?: string };
  hooks?: string[];
  audit?: {
    headline?: string;
    summary?: string;
    strengths?: string[];
    gaps?: string[];
    recommendations?: string[];
  };
};

export const GET = withErrors<{ params: { leadId: string } }>(async (_req, { params }) => {
  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, source: "free-generator" },
    select: { status: true, verification: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const verification = (lead.verification ?? {}) as { free_report?: FreeReport; error?: string };
  const report = verification.free_report ?? null;

  // ready when the report exists; failed on ERROR; otherwise still working.
  const state = report ? "ready" : lead.status === "ERROR" ? "failed" : "pending";

  return NextResponse.json({
    state,
    status: lead.status,
    report,
    error: state === "failed" ? "We hit a snag generating your audit. Please try again." : undefined,
  });
});
