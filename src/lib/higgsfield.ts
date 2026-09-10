import { getOrgKey } from "./settings";
import { MissingKeyError, ConfirmationRequiredError } from "./errors";

/**
 * Higgsfield AI — image / video generation client.
 *
 * ⚠️ SPENDING GUARDRAILS (OWNER HARD RULE — do not remove, do not bypass)
 * ---------------------------------------------------------------------------
 * - Total monthly budget: 200 credits.
 * - NEVER run high-resolution video models (>25 credits) autonomously.
 * - ALWAYS output the estimated credit cost and WAIT for explicit human
 *   confirmation before calling ANY Higgsfield generation endpoint.
 * See docs/HIGGSFIELD_GUARDRAILS.md. Treat every generation like a spend
 * action: estimate → state the cost → get a yes → only then call.
 * ---------------------------------------------------------------------------
 *
 * The key is resolved per-org via getOrgKey() (admin-stored, encrypted) then
 * the env fallback. NOTE: confirm whether the account's plan exposes an API at
 * all (the basic plan may be UI-only). The final HTTP call is intentionally
 * left unimplemented until that's verified; all guardrail plumbing is live.
 */

export type HiggsfieldKind = "image" | "video";

export interface GenerateParams {
  /** Org whose stored HIGGSFIELD_API_KEY should be used. */
  orgId: string;
  kind: HiggsfieldKind;
  prompt: string;
  model?: string;
  /** Caller-supplied estimate; the gate below enforces the guardrails. */
  estimatedCredits?: number;
  /** Must be explicitly true — set only after human confirmation. */
  confirmed?: boolean;
}

/** Hard ceiling for anything that may run without a human in the loop. */
export const AUTONOMOUS_CREDIT_CEILING = 25;

/** Rough, conservative credit estimate used for the confirmation prompt. */
export function estimateCredits(kind: HiggsfieldKind): number {
  return kind === "video" ? 30 : 5;
}

/** True if the org (or env) has a Higgsfield key configured. */
export async function higgsfieldConfigured(orgId: string): Promise<boolean> {
  return (await getOrgKey(orgId, "HIGGSFIELD_API_KEY")) != null;
}

/**
 * Enforces the owner guardrail. Throws ConfirmationRequiredError unless the
 * call is confirmed (or is a cheap, non-video generation under the ceiling).
 */
export function assertWithinGuardrails(p: GenerateParams): void {
  const credits = p.estimatedCredits ?? estimateCredits(p.kind);
  const needsConfirmation = p.kind === "video" || credits > AUTONOMOUS_CREDIT_CEILING;
  if (needsConfirmation && !p.confirmed) {
    throw new ConfirmationRequiredError(
      `Higgsfield ${p.kind} generation is ~${credits} credits and needs explicit confirmation ` +
        `(video and any >${AUTONOMOUS_CREDIT_CEILING}-credit job never run autonomously).`,
      credits,
    );
  }
}

export interface GenerateResult {
  url: string;
  storageKey: string;
  creditsUsed: number;
}

export async function generate(params: GenerateParams): Promise<GenerateResult> {
  // 1) key present?  2) within guardrails / confirmed?
  const apiKey = await getOrgKey(params.orgId, "HIGGSFIELD_API_KEY");
  if (!apiKey) throw new MissingKeyError("HIGGSFIELD_API_KEY");
  assertWithinGuardrails(params);

  // TODO(phase-2): POST to Higgsfield with apiKey, upload the result to R2, and
  // return { url, storageKey, creditsUsed }. Blocked on confirming the plan's
  // API surface — see the header note.
  throw new Error(
    "Higgsfield generation is not yet wired to the provider API (plan API unconfirmed).",
  );
}
