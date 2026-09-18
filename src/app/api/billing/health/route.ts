import { NextResponse } from "next/server";

/**
 * GET /api/billing/health — SAFE payment-config diagnostic (SN25).
 *
 * Reports whether the RUNNING server process can see each RAZORPAY_* var, so we
 * can tell "not set / wrong place / not restarted" apart from "typo". Reveals
 * only booleans + the key-id MODE (test/live) + a 4-char id prefix — never a
 * secret value. Temporary; remove once checkout is verified live.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const names = [
    "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_PLAN_STARTER", "RAZORPAY_PLAN_GROWTH", "RAZORPAY_PLAN_SCALE",
  ];
  const present: Record<string, boolean> = {};
  for (const n of names) present[n] = Boolean(process.env[n] && process.env[n]!.trim());

  const keyId = (process.env.RAZORPAY_KEY_ID ?? "").trim();
  const mode = keyId.startsWith("rzp_live") ? "live" : keyId.startsWith("rzp_test") ? "test" : keyId ? "unknown" : "unset";

  return NextResponse.json({
    configured: present.RAZORPAY_KEY_ID && present.RAZORPAY_KEY_SECRET,
    mode,
    keyIdPrefix: keyId ? keyId.slice(0, 8) : null,
    present,
    node: process.version,
  });
}
