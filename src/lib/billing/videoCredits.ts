/**
 * Video credit estimator — mirrors Higgsfield's REAL per-second pricing so the
 * confirm dialog and the budget check show the actual cost, not a flat guess.
 *
 * Rates measured with `higgsfield generate cost` for the default video model
 * (seedance_2_0, the Starter-plan model) — cost is linear in duration:
 *   480p (fast)  = 1.0 credit/s
 *   720p (fast)  = 2.5 credits/s
 *   1080p (std)  = 9.0 credits/s
 * The runner maps 480p/720p → fast and 1080p → std, so these match what
 * actually runs and gets billed.
 *
 * Pure module (no server-only deps) — safe to import on the client and server.
 * NOTE: these are seedance_2_0 rates. If HIGGSFIELD_VIDEO_MODEL is switched to
 * seedance_2_5 (Pro/Ultimate), add a rate table for it and select by model.
 */
export type VideoResolution = "480p" | "720p" | "1080p";

/** Credits per second by resolution, for seedance_2_0. */
export const VIDEO_CREDITS_PER_SEC: Record<VideoResolution, number> = {
  "480p": 1,
  "720p": 2.5,
  "1080p": 9,
};

/**
 * Estimated Higgsfield credits for a clip. Accurate for seedance_2_0 at integer
 * durations; a close approximation otherwise. Clamps duration to 4–15s.
 */
export function estimateVideoCredits(resolution: string, durationSeconds: number): number {
  const rate = VIDEO_CREDITS_PER_SEC[resolution as VideoResolution] ?? VIDEO_CREDITS_PER_SEC["720p"];
  const d = Math.min(15, Math.max(4, Math.round(Number(durationSeconds) || 6)));
  return Math.round(rate * d * 10) / 10; // keep one decimal (e.g. 37.5)
}
