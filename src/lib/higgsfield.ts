/**
 * Higgsfield AI — image / video generation client (STUB).
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
 * NOTE: confirm whether the account's plan exposes an API at all (the basic
 * plan may be UI-only). Reads HIGGSFIELD_API_KEY from the environment.
 * TODO(phase-2): implement real calls behind a confirmCost() gate.
 */

export type HiggsfieldKind = "image" | "video";

export interface GenerateParams {
  kind: HiggsfieldKind;
  prompt: string;
  model?: string;
  /** Caller-supplied estimate; the gate below enforces the guardrails. */
  estimatedCredits: number;
  /** Must be explicitly true — set only after human confirmation. */
  confirmed?: boolean;
}

/** Hard ceiling for anything that may run without a human in the loop. */
export const AUTONOMOUS_CREDIT_CEILING = 25;

/**
 * Enforces the owner guardrail. Throws unless the call is confirmed (or is a
 * cheap, non-video generation under the autonomous ceiling).
 */
export function assertWithinGuardrails(p: GenerateParams): void {
  const needsConfirmation =
    p.kind === "video" || p.estimatedCredits > AUTONOMOUS_CREDIT_CEILING;
  if (needsConfirmation && !p.confirmed) {
    throw new Error(
      `Higgsfield generation (${p.kind}, ~${p.estimatedCredits} credits) requires explicit confirmation. ` +
        `State the estimated cost and get a yes before calling.`,
    );
  }
}

export async function generate(_params: GenerateParams): Promise<never> {
  assertWithinGuardrails(_params);
  // TODO(phase-2): POST to Higgsfield, upload result to R2, return asset URL.
  throw new Error("TODO(phase-2): Higgsfield generate() not implemented");
}
