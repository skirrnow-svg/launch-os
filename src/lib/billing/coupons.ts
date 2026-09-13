/**
 * Discount coupons — storage + validation.
 *
 * IMPORTANT: this module validates a code and reports the discount it *would*
 * grant; it does NOT increment redeemed_count or apply money off. Live
 * redemption + payment capture arrive with the Razorpay gate (SN25). Until then
 * the admin can create/manage coupons and the storefront can preview validity.
 *
 * SERVER-ONLY (imports the Prisma client).
 */
import { prisma } from "@/lib/db";

export type CouponKind = "percent" | "flat";

export type CouponValidation = {
  valid: boolean;
  reason?: string;
  code?: string;
  kind?: CouponKind;
  value?: number;
};

export const COUPON_KINDS: CouponKind[] = ["percent", "flat"];

/** Normalize a user-entered code: trim + uppercase. */
export function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase();
}

/**
 * Validate a coupon against optional tier context. Respects active flag,
 * expiry, redemption ceiling and applies_to. Never throws — DB errors resolve
 * to an invalid result with a friendly reason.
 */
export async function validateCoupon(rawCode: string, tierSlug?: string): Promise<CouponValidation> {
  const code = normalizeCode(rawCode);
  if (!code) return { valid: false, reason: "Enter a coupon code." };

  let c;
  try {
    c = await prisma.coupons.findUnique({ where: { code } });
  } catch {
    return { valid: false, reason: "Couldn't check that code right now." };
  }

  if (!c || !c.active) return { valid: false, reason: "That code isn't valid." };
  if (c.expires_at && c.expires_at.getTime() < Date.now()) {
    return { valid: false, reason: "That code has expired." };
  }
  if (c.max_redemptions != null && c.redeemed_count >= c.max_redemptions) {
    return { valid: false, reason: "That code has been fully redeemed." };
  }
  if (c.applies_to && c.applies_to !== "all" && tierSlug) {
    const slugs = c.applies_to.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length && !slugs.includes(tierSlug)) {
      return { valid: false, reason: "That code doesn't apply to this plan." };
    }
  }

  return { valid: true, code: c.code, kind: c.kind as CouponKind, value: Number(c.value) };
}
