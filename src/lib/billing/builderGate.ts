/**
 * AI Video Prompt Builder access gate.
 *
 * The builder has two feature levels, gated by the org PLAN's monthly credit
 * allowance (admin-editable per plan via effectiveTiers):
 *   - "basic"    (guided path)      unlocks at >= basic_min credits/month
 *   - "advanced" (full pro controls) unlocks at >= advanced_min credits/month
 *   - "none"     below basic — visible but locked.
 *
 * Both thresholds live on the platform_settings singleton and are editable by a
 * platform admin from the pricing console. Platform admins always resolve to
 * "advanced" (owner testing). SERVER-ONLY (Prisma).
 */
import { prisma } from "@/lib/db";
import { getEntitlement } from "./entitlements";
import { effectiveTiers } from "./pricing";

export type BuilderLevel = "none" | "basic" | "advanced";

export type BuilderAccess = {
  level: BuilderLevel;
  planCredits: number; // the plan's monthly credit allowance used for gating
  basicMin: number;
  advancedMin: number;
};

const DEFAULT_BASIC_MIN = 10;
const DEFAULT_ADVANCED_MIN = 25;

/** The admin-configured thresholds (falls back to code defaults). */
export async function getBuilderThresholds(): Promise<{ basicMin: number; advancedMin: number }> {
  try {
    const s = await prisma.platform_settings.findUnique({ where: { id: "singleton" } });
    return {
      basicMin: s?.builder_basic_min_credits ?? DEFAULT_BASIC_MIN,
      advancedMin: s?.builder_advanced_min_credits ?? DEFAULT_ADVANCED_MIN,
    };
  } catch {
    return { basicMin: DEFAULT_BASIC_MIN, advancedMin: DEFAULT_ADVANCED_MIN };
  }
}

type OrgCapsRow = { id: string; credit_cap: number | null; claude_token_cap: bigint | null };

/** Resolve a workspace's builder access level. Admins are always "advanced". */
export async function resolveBuilderAccess(org: OrgCapsRow, isAdmin: boolean): Promise<BuilderAccess> {
  const { basicMin, advancedMin } = await getBuilderThresholds();
  if (isAdmin) {
    return { level: "advanced", planCredits: Number.POSITIVE_INFINITY, basicMin, advancedMin };
  }

  const ent = await getEntitlement(org);
  let planCredits = 0;
  if (ent.planSlug) {
    // Respect admin-edited plan credits.
    const tiers = await effectiveTiers();
    const tier = tiers.find((t) => t.slug === ent.planSlug);
    planCredits = tier ? tier.creditsPerMonth : ent.credits.cap ?? 0;
  }

  const level: BuilderLevel =
    planCredits >= advancedMin ? "advanced" : planCredits >= basicMin ? "basic" : "none";

  return { level, planCredits, basicMin, advancedMin };
}
