import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { validateCoupon } from "@/lib/billing/coupons";

export const runtime = "nodejs";

/**
 * Public coupon validation. POST { code, tierSlug? } → the discount the code
 * would grant, or a friendly reason it doesn't apply. Does NOT redeem the code
 * or move money — live redemption arrives with the Razorpay gate (SN25).
 */
export const POST = withErrors<unknown>(async (request) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";
  const tierSlug = typeof body.tierSlug === "string" ? body.tierSlug : undefined;
  const result = await validateCoupon(code, tierSlug);
  return NextResponse.json(result);
});
