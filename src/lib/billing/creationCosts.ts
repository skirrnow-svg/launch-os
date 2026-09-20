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

import { prisma } from "@/lib/db";

/**
 * The live per-creation token costs — admin-editable via `platform_settings`
 * (Admin → Visitors & Brand controls). Falls back to the constants above if the
 * row/columns are unavailable.
 */
export async function getCreationTokenCosts(): Promise<{ image: number; video: number }> {
  try {
    const s = await prisma.platform_settings.findUnique({
      where: { id: "singleton" },
      select: { brand_image_tokens: true, brand_video_tokens: true },
    });
    return {
      image: s?.brand_image_tokens ?? CREATION_TOKEN_COST.image,
      video: s?.brand_video_tokens ?? CREATION_TOKEN_COST.video,
    };
  } catch {
    return { ...CREATION_TOKEN_COST };
  }
}
