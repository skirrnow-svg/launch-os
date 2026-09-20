import { prisma } from "@/lib/db";

/**
 * Free-wedge entitlement: ONE free use per email address, per wedge.
 *
 * Each wedge records a Lead with a distinct `source` ("free-generator" for the
 * Product-to-Ad audit, "brand-studio" for Brand Studio). A prior lead with the
 * same email + source means the visitor already claimed their one free run and
 * must create an account to continue. Enforced server-side (email-keyed) so it
 * can't be bypassed by clearing localStorage or opening an incognito window.
 */
export type FreeSource = "free-generator" | "brand-studio";

const norm = (email: string) => email.trim().toLowerCase();

/** True if this email has already claimed its free use of the given wedge. */
export async function hasClaimedFree(
  orgId: string,
  email: string,
  source: FreeSource,
): Promise<boolean> {
  const existing = await prisma.lead.findFirst({
    where: {
      org_id: orgId,
      source,
      email: { equals: norm(email), mode: "insensitive" },
    },
    select: { id: true },
  });
  return Boolean(existing);
}
