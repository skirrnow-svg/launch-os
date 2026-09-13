/**
 * Usage telemetry — the itemized ledger behind the audit log.
 *
 * Every AI generation writes one usage_events row so spend is auditable per org,
 * per provider, per model. Two axes, metered separately:
 *   - Higgsfield credits (media). The org's credits_used counter is incremented
 *     at the generation site (lib/credits.ts / the runner), so recordUsage only
 *     LOGS the event — it does not touch credits_used (avoids double counting).
 *   - Claude tokens (copy/audit). Nothing else counts these, so recordUsage both
 *     logs the event AND increments claude_tokens_used.
 *
 * Telemetry must never break the primary action, so every write is best-effort.
 */
import { prisma } from "@/lib/db";

export type UsageProvider = "higgsfield" | "claude";

export type RecordUsageInput = {
  orgId: string;
  userId?: string | null;
  provider: UsageProvider;
  /** What was produced: 'image' | 'video' | 'website' | 'copy' | 'audit' | 'brief' | … */
  kind: string;
  model?: string | null;
  /** Higgsfield credits (0 for Claude). */
  credits?: number;
  /** Claude tokens (0 for Higgsfield). */
  tokens?: number;
  /** True when tokens are an estimate (chars/4) rather than exact. */
  estimated?: boolean;
  status?: string;
  refType?: string | null;
  refId?: string | null;
};

/** Rough token estimate when exact counts aren't available (~4 chars/token). */
export function estimateTokens(...parts: (string | undefined | null)[]): number {
  const chars = parts.reduce((n, p) => n + (p ? p.length : 0), 0);
  return Math.max(1, Math.ceil(chars / 4));
}

/** Write one usage_events row (+ increment claude_tokens_used for Claude). Never throws. */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  const credits = Number.isFinite(input.credits) ? Number(input.credits) : 0;
  const tokens = Number.isFinite(input.tokens) ? Math.max(0, Math.round(Number(input.tokens))) : 0;
  try {
    await prisma.usage_events.create({
      data: {
        org_id: input.orgId,
        user_id: input.userId ?? null,
        provider: input.provider,
        kind: input.kind,
        model: input.model ?? null,
        credits,
        tokens: BigInt(tokens),
        estimated: input.estimated ?? false,
        status: input.status ?? "ok",
        ref_type: input.refType ?? null,
        ref_id: input.refId ?? null,
      },
    });
    if (input.provider === "claude" && tokens > 0) {
      await prisma.organizations.update({
        where: { id: input.orgId },
        data: { claude_tokens_used: { increment: BigInt(tokens) } },
      });
    }
  } catch {
    /* telemetry is best-effort — never break generation */
  }
}
