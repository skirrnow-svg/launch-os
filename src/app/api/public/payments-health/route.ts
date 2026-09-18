import { NextResponse } from "next/server";

/**
 * GET /api/public/payments-health — SAFE payment-config diagnostic (SN25).
 *
 * Public (under /api/public, so it isn't behind Clerk) so we can verify from
 * outside whether the RUNNING server sees each RAZORPAY_* var. Reveals only
 * booleans + the key-id MODE (test/live) + a 4-char prefix — never a secret
 * value. Temporary; remove once checkout is verified live.
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
  const keySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();
  const mode = keyId.startsWith("rzp_live") ? "live" : keyId.startsWith("rzp_test") ? "test" : keyId ? "unknown" : "unset";

  // Live credential check: does THIS server's key pair authenticate at Razorpay?
  // Reveals only ok/status, never the secret. (idLen/secretLen help spot a
  // truncated paste without exposing the value.)
  let credentialCheck: { ok: boolean; status?: number; error?: string } | null = null;
  if (keyId && keySecret) {
    try {
      const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const r = await fetch("https://api.razorpay.com/v1/plans?count=1", { headers: { Authorization: auth }, cache: "no-store" });
      credentialCheck = { ok: r.status === 200, status: r.status };
    } catch (e) {
      credentialCheck = { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
    }
  }

  // Plan-id check: does each configured plan actually resolve under this key?
  // Reports the plan id (not a secret) + HTTP status so a wrong/truncated id is
  // obvious. Only runs when the credentials authenticate.
  const planChecks: Record<string, { id: string | null; len: number; valid: boolean; status?: number }> = {};
  if (credentialCheck?.ok) {
    const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    for (const k of ["RAZORPAY_PLAN_STARTER", "RAZORPAY_PLAN_GROWTH", "RAZORPAY_PLAN_SCALE"]) {
      const pid = (process.env[k] ?? "").trim();
      if (!pid) { planChecks[k] = { id: null, len: 0, valid: false }; continue; }
      try {
        const r = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(pid)}`, { headers: { Authorization: auth }, cache: "no-store" });
        planChecks[k] = { id: pid, len: pid.length, valid: r.status === 200, status: r.status };
      } catch { planChecks[k] = { id: pid, len: pid.length, valid: false }; }
    }
  }

  return NextResponse.json({
    configured: present.RAZORPAY_KEY_ID && present.RAZORPAY_KEY_SECRET,
    mode,
    keyIdPrefix: keyId ? keyId.slice(0, 8) : null,
    idLen: keyId.length,
    secretLen: keySecret.length,
    credentialCheck,
    planChecks,
    present,
    node: process.version,
  });
}
