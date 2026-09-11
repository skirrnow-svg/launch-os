import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";

export const runtime = "edge";

type Ctx = { params: { leadId: string } };

/**
 * POST /api/leads/[leadId]/approve — the 1-Click HITL gate.
 *
 * Marks the qualified lead's sample email campaign(s) READY_FOR_DELIVERY. Only
 * a QUALIFIED lead in the caller's org can be approved. Idempotent: campaigns
 * already delivered are left as-is.
 */
export const POST = withErrors<Ctx>(async (_req, { params }) => {
  const { org } = await getContext();

  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, org_id: org.id },
    include: { client_profile: { select: { project_id: true } } },
  });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (lead.status !== "QUALIFIED" || !lead.client_profile) {
    return NextResponse.json({ error: "Lead is not qualified for delivery." }, { status: 400 });
  }

  const updated = await prisma.email_campaigns.updateMany({
    where: {
      project_id: lead.client_profile.project_id,
      status: { in: ["draft", "queued", "generating"] },
    },
    data: { status: "ready_for_delivery" },
  });

  return NextResponse.json({ ok: true, campaigns_marked: updated.count });
});
