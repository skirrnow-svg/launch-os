import { prisma } from "@/lib/db";

/**
 * Free-wedge entitlement.
 *
 * Brand Studio (image/video branding) is unlimited and free — it has NO limit
 * here. The Product-to-Ad generator gives each email a small number of free
 * ads, after which a payment wall applies. Usage is counted from the Lead table
 * by email + source, so it's enforced server-side (email-keyed) and can't be
 * bypassed by clearing localStorage or using incognito.
 */
export type FreeSource = "free-generator" | "brand-studio";

/** Free Product-to-Ad audits allowed per email before the payment wall. */
export const FREE_AD_LIMIT = 2;

const norm = (email: string) => email.trim().toLowerCase();

/** How many times this email has already used the given free wedge. */
export async function countFreeUses(
  orgId: string,
  email: string,
  source: FreeSource,
): Promise<number> {
  return prisma.lead.count({
    where: {
      org_id: orgId,
      source,
      email: { equals: norm(email), mode: "insensitive" },
    },
  });
}
