/**
 * Per-action credit costs.
 *
 * Business model: ONE shared media-credit wallet, but each generation type burns
 * a configurable amount (video weighs more than image). This gives the admin
 * fine control over every action's cost WITHOUT giving customers multiple
 * balances to track. Text (copy) runs on the Claude subscription and web/landing
 * pages are self-contained HTML — both cost 0 media credits and are governed by
 * the per-plan Claude-token and landing-page allowances instead.
 *
 * Values live on the platform_settings singleton and are admin-editable from the
 * pricing console. Reads fall back to the code defaults if the DB is unreachable.
 * SERVER-ONLY (Prisma).
 */
import { prisma } from "@/lib/db";

export type ActionKind = "video" | "image";

/** Code defaults — the coarse pre-flight estimates used before any override. */
export const DEFAULT_ACTION_COSTS: Record<ActionKind, number> = { video: 30, image: 7 };

/** Free actions (informational, for the admin UI). Never burn media credits. */
export const FREE_ACTIONS = [
  { key: "text", label: "Ad copy / text", note: "Claude subscription — 0 credits (metered by plan token allowance)" },
  { key: "landing", label: "Landing / web page", note: "Self-contained HTML — 0 credits (metered by plan page quota)" },
] as const;

/** Admin-configured per-action costs (falls back to defaults). */
export async function getActionCosts(): Promise<Record<ActionKind, number>> {
  try {
    const s = await prisma.platform_settings.findUnique({ where: { id: "singleton" } });
    return {
      video: s?.credit_cost_video ?? DEFAULT_ACTION_COSTS.video,
      image: s?.credit_cost_image ?? DEFAULT_ACTION_COSTS.image,
    };
  } catch {
    return { ...DEFAULT_ACTION_COSTS };
  }
}

/** The configured credit cost for one action of the given kind. */
export async function creditCostFor(kind: ActionKind): Promise<number> {
  const costs = await getActionCosts();
  return costs[kind];
}
