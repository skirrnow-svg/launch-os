/**
 * Entitlements — resolves a workspace's allowances (Higgsfield credits + Claude
 * tokens) and its billing PERIOD from the subscription in use.
 *
 * Precedence for each cap:
 *   1. An explicit per-org override (organizations.credit_cap / claude_token_cap)
 *      — admin fine-tuning, wins when set.
 *   2. The active subscription's plan (Starter/Growth/Scale) allowance.
 *   3. The free defaults (no active plan).
 *
 * The active PERIOD is the current billing cycle, anchored on the subscription's
 * anchor_at and rolled forward monthly (so usage resets each cycle with no cron).
 * With no subscription it's the current calendar month. Usage "used this period"
 * is summed from the usage_events ledger, so nothing needs zeroing on reset.
 *
 * SERVER-ONLY (Prisma). Razorpay (SN25) later upserts subscriptions with real
 * period data; this resolver doesn't change.
 */
import { prisma } from "@/lib/db";
import { BILLING_TIERS, FREE_CLAUDE_TOKENS, tierBySlug } from "./plans";

export type Period = { start: Date; end: Date };

export type Entitlement = {
  planSlug: string | null;                 // null = free / no active plan
  planName: string;                        // "Free" | "Starter" | …
  status: "free" | "active" | "trialing" | "canceled";
  provider: string;                        // 'manual' | 'razorpay' | 'free'
  credits: { cap: number | null; source: "override" | "plan" | "free" };
  claude: { cap: number; source: "override" | "plan" | "free" };
  period: Period;
  periodLabel: string;                     // human, e.g. "1 Sep – 1 Oct 2026"
};

/** Add whole months to a date, clamping the day to the target month's length. */
function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
}

/** The billing period containing `now`, anchored on `anchor` and stepped monthly. */
export function currentPeriod(anchor: Date, now: Date = new Date()): Period {
  let start = new Date(anchor.getTime());
  if (start > now) {
    // Anchor is in the future (just assigned): the period starts now.
    return { start: now, end: addMonths(now, 1) };
  }
  while (addMonths(start, 1) <= now) start = addMonths(start, 1);
  return { start, end: addMonths(start, 1) };
}

/** Current calendar month, used when there's no subscription. */
function calendarMonth(now: Date = new Date()): Period {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type OrgCapsRow = { id: string; credit_cap: number | null; claude_token_cap: bigint | null };

export async function getEntitlement(org: OrgCapsRow): Promise<Entitlement> {
  const sub = await prisma.subscriptions
    .findUnique({ where: { org_id: org.id } })
    .catch(() => null);

  const overrideCredit = org.credit_cap;
  const overrideClaude = org.claude_token_cap == null ? null : Number(org.claude_token_cap);

  const active = sub && (sub.status === "active" || sub.status === "trialing");
  const plan = active ? tierBySlug(sub!.plan_slug) : null;

  const period = active ? currentPeriod(sub!.anchor_at) : calendarMonth();

  // Credits cap: override → plan → free (null = unlimited).
  let creditCap: number | null;
  let creditSource: "override" | "plan" | "free";
  if (overrideCredit != null) { creditCap = overrideCredit; creditSource = "override"; }
  else if (plan) { creditCap = plan.creditsPerMonth; creditSource = "plan"; }
  else { creditCap = null; creditSource = "free"; }

  // Claude cap: override → plan → free default.
  let claudeCap: number;
  let claudeSource: "override" | "plan" | "free";
  if (overrideClaude != null) { claudeCap = overrideClaude; claudeSource = "override"; }
  else if (plan) { claudeCap = plan.claudeTokensPerMonth; claudeSource = "plan"; }
  else { claudeCap = FREE_CLAUDE_TOKENS; claudeSource = "free"; }

  return {
    planSlug: plan ? plan.slug : null,
    planName: plan ? plan.name : "Free",
    status: active ? (sub!.status as "active" | "trialing") : sub ? "canceled" : "free",
    provider: sub ? sub.provider : "free",
    credits: { cap: creditCap, source: creditSource },
    claude: { cap: claudeCap, source: claudeSource },
    period,
    periodLabel: `${fmtDate(period.start)} – ${fmtDate(period.end)}`,
  };
}

/** Sum usage in [start, end) for an org, split by provider. */
export async function periodUsage(orgId: string, period: Period): Promise<{ credits: number; tokens: number; creditEvents: number; tokenEvents: number }> {
  const rows = await prisma.usage_events.groupBy({
    by: ["provider"],
    where: { org_id: orgId, created_at: { gte: period.start, lt: period.end } },
    _sum: { credits: true, tokens: true },
    _count: { _all: true },
  });
  let credits = 0, tokens = 0, creditEvents = 0, tokenEvents = 0;
  for (const r of rows) {
    const s = r._sum as { credits: unknown; tokens: unknown };
    if (r.provider === "higgsfield") { credits = Number(s.credits ?? 0); creditEvents = (r._count as { _all: number })._all; }
    if (r.provider === "claude") { tokens = Number(s.tokens ?? 0); tokenEvents = (r._count as { _all: number })._all; }
  }
  return { credits, tokens, creditEvents, tokenEvents };
}

/** Valid plan slugs for admin assignment. */
export const PLAN_SLUGS = BILLING_TIERS.map((t) => t.slug) as string[];

/**
 * Max landing / web pages a workspace may hold, by account type. Platform admins
 * are unlimited. solo 1 · sme 2 · agency 20 · admin ∞. Returns Infinity for
 * unlimited (callers treat any value <= existing count as "at quota").
 */
export function webPageQuota(accountType: string | null | undefined, isAdmin: boolean): number {
  if (isAdmin) return Infinity;
  switch (accountType) {
    case "agency": return 20;
    case "sme": return 2;
    default: return 1; // solo / unknown / free
  }
}
