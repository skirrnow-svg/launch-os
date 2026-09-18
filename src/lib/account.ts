/**
 * Account lifecycle — deactivate (reversible) and delete (permanent).
 * SERVER-ONLY. Used by /api/account/*.
 *
 * Deactivate: cancel recurring billing at cycle end and mark the user inactive;
 *   data is kept and signing back in reactivates (getOrCreateUser clears
 *   deleted_at on login).
 * Delete: cancel billing immediately, anonymize the user (frees the unique
 *   email), soft-delete their workspaces, and delete the Clerk login so the
 *   account can't sign in again. Irreversible.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { cancelSubscription } from "@/lib/billing/razorpay";

/** Cancel the Razorpay subscriptions on the given orgs and update local rows. */
async function cancelOrgSubs(orgIds: string[], atCycleEnd: boolean): Promise<void> {
  if (orgIds.length === 0) return;
  const subs = await prisma.subscriptions.findMany({ where: { org_id: { in: orgIds } } });
  for (const s of subs) {
    const live = s.status === "active" || s.status === "trialing";
    if (live && s.provider === "razorpay" && s.external_id) {
      try { await cancelSubscription(s.external_id, atCycleEnd); } catch { /* best-effort */ }
    }
    await prisma.subscriptions
      .update({
        where: { org_id: s.org_id },
        data: atCycleEnd
          ? { cancel_at_period_end: true, updated_at: new Date() }
          : { status: "canceled", cancel_at_period_end: false, updated_at: new Date() },
      })
      .catch(() => null);
  }
}

/** Owned, non-deleted orgs for a user. */
async function ownedOrgIds(userId: string): Promise<string[]> {
  const orgs = await prisma.organizations.findMany({
    where: { created_by: userId, deleted_at: null },
    select: { id: true },
  });
  return orgs.map((o) => o.id);
}

/**
 * Deactivate (reversible). Stops recurring billing at cycle end and flags the
 * user inactive. Data is preserved; signing back in reactivates the account.
 */
export async function deactivateAccount(userId: string): Promise<void> {
  await cancelOrgSubs(await ownedOrgIds(userId), true);
  await prisma.users.update({ where: { id: userId }, data: { deleted_at: new Date() } }).catch(() => null);
}

/**
 * Delete (permanent). Cancels billing now, soft-deletes the user's workspaces,
 * anonymizes the user row (freeing the unique email), and deletes the Clerk
 * login. Cannot be undone.
 */
export async function deleteAccount(user: { id: string; auth_id: string }): Promise<void> {
  const orgIds = await ownedOrgIds(user.id);
  await cancelOrgSubs(orgIds, false);

  const now = new Date();
  if (orgIds.length) {
    await prisma.organizations.updateMany({ where: { id: { in: orgIds } }, data: { deleted_at: now } });
  }
  await prisma.users
    .update({
      where: { id: user.id },
      data: {
        deleted_at: now,
        email: `deleted+${user.id}@deleted.skirrnow.invalid`,
        name: "Deleted user",
        avatar_url: null,
      },
    })
    .catch(() => null);

  // Remove the Clerk login last (invalidates the session). Best-effort: the DB
  // is already anonymized even if this call fails.
  try {
    const cc = await clerkClient();
    await cc.users.deleteUser(user.auth_id);
  } catch { /* best-effort */ }
}
