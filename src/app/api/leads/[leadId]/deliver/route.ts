import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { sendEmail } from "@/lib/resend";

type Ctx = { params: { leadId: string } };

/**
 * POST /api/leads/[leadId]/deliver — the actual outbound send.
 *
 * Sends the lead's APPROVED (ready_for_delivery) sample email(s) to the
 * prospect via Resend, then marks each 'sent' (or 'failed' with the reason).
 * Separate from approve on purpose: approve = human sign-off, deliver = the
 * outward action. Only a QUALIFIED lead in the caller's org can be delivered.
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

  const campaigns = await prisma.email_campaigns.findMany({
    where: { project_id: lead.client_profile.project_id, status: "ready_for_delivery" },
  });
  if (campaigns.length === 0) {
    return NextResponse.json(
      { error: "Nothing to send — approve the sample first (no campaigns are ready for delivery)." },
      { status: 400 },
    );
  }

  let sent = 0;
  const errors: string[] = [];
  for (const c of campaigns) {
    try {
      await sendEmail({ to: lead.email, subject: c.subject, html: c.template_html });
      await prisma.email_campaigns.update({
        where: { id: c.id },
        data: { status: "sent", sent_at: new Date() },
      });
      sent += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.email_campaigns.update({ where: { id: c.id }, data: { status: "failed" } });
      errors.push(message);
    }
  }

  if (sent === 0) {
    return NextResponse.json(
      { error: errors[0] || "Send failed.", sent, failed: errors.length },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, sent, failed: errors.length, to: lead.email });
});
