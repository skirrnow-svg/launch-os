import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerRunner } from "@/lib/jobs";
import { withErrors } from "@/lib/api";

type Ctx = { params: { leadId: string } };

/**
 * POST /api/leads/[leadId]/requeue — re-run a NEEDS_INFO lead through
 * qualification after the operator supplies more detail, and/or overrides the
 * AI's soft checks.
 *
 * Body: { addendum?: string, force?: boolean }.
 *  - addendum: extra business/location/offer/contact detail, appended to the
 *    lead so re-extraction has better data.
 *  - force: "approve anyway" — the runner then skips the plausibility/location
 *    checks (but still requires the core fields and passes legal review).
 *
 * Resets the lead to PENDING/INTERESTED and wakes the runner. Only a NEEDS_INFO
 * lead in the caller's org can be re-queued.
 */
export const POST = withErrors<Ctx>(async (req, { params }) => {
  const { org } = await getContext();

  const lead = await prisma.lead.findFirst({ where: { id: params.leadId, org_id: org.id } });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (lead.status !== "NEEDS_INFO") {
    return NextResponse.json(
      { error: "Only a lead that needs info can be re-run." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { addendum?: unknown; force?: unknown };
  const addendum = typeof body.addendum === "string" ? body.addendum.trim() : "";
  const force = body.force === true;

  if (!addendum && !force) {
    return NextResponse.json(
      { error: "Add some detail, or choose to approve anyway." },
      { status: 400 },
    );
  }

  const raw_body = addendum
    ? `${lead.raw_body}\n\nAdditional details from operator:\n${addendum}`
    : lead.raw_body;

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      raw_body,
      status: "PENDING",
      intent_status: "INTERESTED",
      // Consumed by the runner on the next pass; overwritten when it re-audits.
      verification: force ? { force_qualify: true } : {},
    },
  });

  await triggerRunner("generate");
  return NextResponse.json({ ok: true, requeued: true, forced: force });
});
