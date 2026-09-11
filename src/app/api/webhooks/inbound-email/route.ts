import { NextResponse } from "next/server";
import { ingestLead, resolveOrgId } from "@/lib/leads";
import { withErrors } from "@/lib/api";


/**
 * POST /api/webhooks/inbound-email — ingest a prospect email reply.
 *
 * PUBLIC route (see middleware): inbound providers can't carry a Clerk session.
 * Body: { sender_email, subject?, body_text, org_id }. `org_id` may be the
 * internal organizations.id (uuid) or the Clerk org id — both resolve to the
 * internal tenant id so Lead rows stay isolated like every other table.
 *
 * On positive intent (INTERESTED) it inserts a PENDING Lead and fires a
 * `process_lead_qualification` repository_dispatch to wake the Actions runner.
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

  const orgId = await resolveOrgId(orgKey);
  if (!orgId) return NextResponse.json({ error: "Unknown org_id." }, { status: 404 });

  const result = await ingestLead({ orgId, email, subject, body: rawBody });
  return NextResponse.json({ ok: true, ...result });
});
