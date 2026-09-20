/**
 * Notional SkirrNow AI-token cost per client-side creation (Brand Studio).
 *
 * These creations run entirely in the browser and use no real model tokens, but
 * we still meter them against the account's AI-token allowance so an otherwise
 * "unlimited" feature is bounded by the plan (and the free tier). Tune freely —
 * the free tier is 100k tokens, so at these costs that's ~200 branded images or
 * ~66 branded videos per cycle.
 */
export const CREATION_TOKEN_COST: Record<"image" | "video", number> = {
  image: 500,
  video: 1500,
};
