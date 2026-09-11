import { prisma } from "./db";
import { triggerRunner } from "./jobs";
import { classifyIntent, type Intent } from "./intent";

/**
 * Shared inbound-lead ingestion — used by both the email webhook and the
 * public "Get started" form. Inserts a Lead and, when the intent is positive,
 * wakes the Actions runner to qualify it.
 */
export type IngestResult = { lead_id: string; intent_status: Intent; dispatched: boolean };

export async function ingestLead(params: {
  orgId: string;
  email: string;
  subject?: string;
  body: string;
  forceInterested?: boolean;
}): Promise<IngestResult> {
  const subject = params.subject ?? "";
  const intent: Intent = params.forceInterested
    ? "INTERESTED"
    : classifyIntent(subject, params.body);

  const lead = await prisma.lead.create({
    data: {
      org_id: params.orgId,
      email: params.email,
      raw_body: subject ? `Subject: ${subject}\n\n${params.body}` : params.body,
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
  return { lead_id: lead.id, intent_status: intent, dispatched };
}

/** Resolve an internal org id from either its uuid or a Clerk org id. */
export async function resolveOrgId(key: string): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const org = await prisma.organizations.findFirst({
    where: { OR: [{ clerk_org_id: key }, ...(isUuid ? [{ id: key }] : [])] },
    select: { id: true },
  });
  return org?.id ?? null;
}
