/**
 * Admin action audit — records platform-admin config changes to audit_logs
 * (pricing edits, coupon create/toggle/delete, org account-type/credit/token-cap
 * changes, branding). Attribute to the acting admin's org + user.
 *
 * resource_id is a uuid column, so only pass it when the id IS a uuid (e.g. a
 * target org id). For non-uuid identifiers (tier slug, coupon code) leave it null
 * and put the identifier in `changes`. Best-effort — never breaks the action.
 */
import { prisma } from "@/lib/db";

export type RecordAuditInput = {
  /** Acting admin's org id (uuid). */
  orgId: string;
  /** Acting admin's user id (uuid). */
  userId?: string | null;
  /** Dotted action, e.g. 'pricing.update', 'coupon.create', 'org.update'. */
  action: string;
  /** Resource class, e.g. 'pricing' | 'coupon' | 'offer' | 'organization' | 'branding'. */
  resourceType: string;
  /** Only when it is a real uuid (e.g. target org id); otherwise null. */
  resourceId?: string | null;
  /** The change payload (identifiers, before/after). */
  changes?: Record<string, unknown>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.audit_logs.create({
      data: {
        org_id: input.orgId,
        user_id: input.userId ?? null,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId && UUID_RE.test(input.resourceId) ? input.resourceId : null,
        // Normalize through JSON so it satisfies Prisma's Json input type.
        changes: input.changes ? JSON.parse(JSON.stringify(input.changes)) : undefined,
      },
    });
  } catch {
    /* audit is best-effort */
  }
}
