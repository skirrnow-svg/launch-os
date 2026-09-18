/**
 * Razorpay integration (SN25) — server-only.
 *
 * ONE shared media-credit wallet per org. A paid Razorpay *subscription* grants
 * a plan's monthly credit cap; each `subscription.charged` webhook refills it.
 * A one-time *order* (order.paid) tops up credits mid-cycle.
 *
 * We talk to Razorpay over plain HTTPS (no SDK dependency) with HTTP Basic auth
 * (key_id:key_secret) and verify every webhook with the shared webhook secret.
 * The ACTIVE key set is RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (test now, live at
 * go-live); the live values stay parked under RAZORPAY_LIVE_* until then.
 */
import crypto from "crypto";

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** Public key id — safe to hand to the browser Checkout widget. */
export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

/** True when the ACTIVE key is a test-mode key (rzp_test_…). */
export function razorpayIsTestMode(): boolean {
  return razorpayKeyId().startsWith("rzp_test");
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: authHeader(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = (data?.error?.description as string) || `Razorpay ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export type RazorpaySubscription = { id: string; status: string; plan_id: string; short_url?: string };

/**
 * Create a subscription against a plan. `notes` carries our org_id + plan_slug so
 * the webhook can resolve the tenant without trusting client input. `total_count`
 * is Razorpay-required; 120 monthly cycles ≈ open-ended.
 */
export async function createSubscription(opts: {
  planId: string;
  orgId: string;
  planSlug: string;
  totalCount?: number;
}): Promise<RazorpaySubscription> {
  return api<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: opts.planId,
      total_count: opts.totalCount ?? 120,
      quantity: 1,
      customer_notify: 1,
      notes: { org_id: opts.orgId, plan_slug: opts.planSlug },
    }),
  });
}

/** Cancel a subscription at Razorpay (cancel_at_cycle_end=0 → immediate). */
export async function cancelSubscription(subId: string, atCycleEnd = true): Promise<void> {
  await api(`/subscriptions/${subId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  });
}

/**
 * Verify a Razorpay webhook. Compares HMAC-SHA256(rawBody, webhookSecret) with
 * the x-razorpay-signature header in constant time. Returns false if unset.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verify a browser Checkout success payload for a subscription. Razorpay signs
 * `payment_id|subscription_id` with the key secret.
 */
export function verifySubscriptionPayment(paymentId: string, subscriptionId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${paymentId}|${subscriptionId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
