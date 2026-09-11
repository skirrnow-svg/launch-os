import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerRunner } from "@/lib/jobs";
import { classifyIntent } from "@/lib/intent";
import { withErrors } from "@/lib/api";

export const runtime = "edge";

/**
 * POST /api/webhooks/inbound-email — ingest a prospect email reply.
 *
 * PUBLIC route (see middleware): inbound providers can't carry a Clerk session.
 * Body: { sender_email, subject?, body_text, org_id }. `org_id` may be the
 * internal organizations.id (uuid) or the Clerk org id — both are resolved to
 * the internal tenant id so Lead rows stay isolated like every other table.
 *
 * On positive intent (INTERESTED) it inserts a PENDING Lead and fires a
 * `process_lead_qualification` repository_dispatch to wake the Actions runner
 * (which does the claude -p extraction, verification, and provisioning).
 *
 * TODO(security): verify a provider HMAC signature before trusting org_id.
 */
export const POST = withErrors<unknown>(async (request) => {
  const body = (await request.json().catch(() => ({}))) as {
    sender_email?: unknown;
    subject?: unknown;
    body_text?: unknown;
    org_id?: unknown;
  };

  const email = typeof body.sender_email === "string" ? body.sender_email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const rawBody = typeof body.body_text === "string" ? body.body_text : "";
  const orgKey = typeof body.org_id === "string" ? body.org_id.trim() : "";

  if (!email || !rawBody || !orgKey) {
    return NextResponse.json(
      { error: "sender_email, body_text and org_id are required." },
      { status: 400 },
    );
  }

  // Resolve org_id (internal uuid OR clerk_org_id) to the internal tenant id.
  const org = await prisma.organizations.findFirst({
    where: { OR: [{ clerk_org_id: orgKey }, ...(isUuid(orgKey) ? [{ id: orgKey }] : [])] },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Unknown org_id." }, { status: 404 });
  }

  const intent = classifyIntent(subject, rawBody);

  const lead = await prisma.lead.create({
    data: {
      org_id: org.id,
      email,
      raw_body: subject ? `Subject: ${subject}\n\n${rawBody}` : rawBody,
      intent_status: intent,
      status: intent === "UNSUBSCRIBE" ? "REJECTED" : "PENDING",
    },
    select: { id: true },
  });

  let dispatched = false;
  if (intent === "INTERESTED") {
    await triggerRunner("process_lead_qualification");
    dispatched = true;
  }

  return NextResponse.json({ ok: true, lead_id: lead.id, intent_status: intent, dispatched });
});

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
