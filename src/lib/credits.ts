import { prisma } from "./db";
import { BudgetExceededError } from "./errors";

/**
 * Per-org generation credit budget (multi-tenant fix #1).
 *
 * organizations.credit_cap NULL = unlimited (single-owner default). When set,
 * an org may spend at most (credit_cap − credits_used) Higgsfield credits. This
 * bounds the shared 200-credit pool per tenant so one can't drain it.
 */

export type OrgBudget = { cap: number | null; used: number; remaining: number | null };

export async function getOrgBudget(orgId: string): Promise<OrgBudget> {
  const org = await prisma.organizations.findUnique({
    where: { id: orgId },
    select: { credit_cap: true, credits_used: true },
  });
  const cap = org?.credit_cap ?? null;
  const used = Number(org?.credits_used ?? 0);
  return { cap, used, remaining: cap == null ? null : Math.max(0, cap - used) };
}

/** Throw BudgetExceededError if `cost` would push the org past its cap. */
export async function assertOrgBudget(orgId: string, cost: number): Promise<void> {
  const { remaining } = await getOrgBudget(orgId);
  if (remaining != null && cost > remaining) {
    throw new BudgetExceededError(cost, remaining);
  }
}

/** Record credits actually spent by an org (atomic increment). */
export async function recordOrgSpend(orgId: string, credits: number): Promise<void> {
  if (!Number.isFinite(credits) || credits <= 0) return;
  await prisma.organizations.update({
    where: { id: orgId },
    data: { credits_used: { increment: credits } },
  });
}
