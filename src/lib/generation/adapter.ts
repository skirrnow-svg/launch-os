/**
 * Generation provider adapter — the one seam that decides WHICH backend fulfils
 * image/video generation. Today that is Higgsfield (on the GitHub Actions
 * runner, 200-credit/month cap). The pivot playbook's planned migration moves
 * images to Runware and premium/video to fal.ai, pay-as-you-go. When that lands,
 * add a provider object here and flip `GENERATION_PROVIDER` — no route or model
 * changes. Adding a provider must NOT add a new fixed-fee dependency to the app
 * tier; the provider only names the model + estimates credits. The actual CLI
 * call lives on the runner.
 *
 * Kept node-free so edge/route handlers can import it.
 */
import { modelFor, staticCreditEstimate } from "@/lib/jobs";

export type GenerationKind = "image" | "video";

export type GenerationProvider = {
  /** Stable id, also the value of the GENERATION_PROVIDER env var. */
  id: string;
  /** Model identifier the runner should use for this kind. */
  modelFor(kind: GenerationKind): string;
  /** Coarse, CLI-free credit estimate for the confirm-before-spend prompt. */
  creditEstimate(kind: GenerationKind): number;
};

/** Current backend: Higgsfield via the runner. Delegates to the existing seam. */
const higgsfield: GenerationProvider = {
  id: "higgsfield",
  modelFor: (kind) => modelFor(kind),
  creditEstimate: (kind) => staticCreditEstimate(kind),
};

const PROVIDERS: Record<string, GenerationProvider> = {
  higgsfield,
  // runware / fal: add here when the migration lands (playbook target state).
};

/** The active provider, chosen by env; defaults to Higgsfield. */
export function activeProvider(): GenerationProvider {
  const id = process.env.GENERATION_PROVIDER?.trim();
  return (id && PROVIDERS[id]) || higgsfield;
}
