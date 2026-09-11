/**
 * Generation job dispatch — the seam between the web tier and the runner.
 *
 * Locally (and on the runner itself) GENERATION_MODE is "inline": the API
 * routes shell out to the CLIs directly. On Cloudflare Pages — which can't run
 * binaries — set GENERATION_MODE="queue": the routes mark the row `queued` and
 * fire a GitHub `repository_dispatch` so the Actions runner fulfils it.
 *
 * See the deploy plan: Pages (UI) → Neon (queue) → GitHub Actions (CLIs) → R2.
 */

export type GenerationMode = "inline" | "queue";

export function generationMode(): GenerationMode {
  return process.env.GENERATION_MODE === "queue" ? "queue" : "inline";
}

/** Coarse, CLI-free credit estimate for the confirmation prompt in queue mode. */
export function staticCreditEstimate(kind: "image" | "video"): number {
  return kind === "video" ? 30 : 7;
}

/** Default Higgsfield model per kind (kept node-free so edge routes can import it). */
export function modelFor(kind: "image" | "video"): string {
  return kind === "video" ? "seedance_2_0" : "gpt_image_2";
}

/**
 * Wake the GitHub Actions runner via repository_dispatch. Best-effort: if the
 * token/repo env is missing or the call fails, the workflow's cron safety net
 * still picks the job up within a few minutes.
 */
export async function triggerRunner(eventType = "generate"): Promise<void> {
  const repo = process.env.GITHUB_DISPATCH_REPO; // "owner/name"
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!repo || !token) return;
  try {
    await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "launch-os",
      },
      body: JSON.stringify({ event_type: eventType }),
    });
  } catch {
    /* cron safety net will catch the job */
  }
}
