import { NextResponse } from "next/server";
import { getContext, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveBuilderAccess } from "@/lib/billing/builderGate";
import { triggerRunner } from "@/lib/jobs";
import { estimateVideoCredits } from "@/lib/billing/videoCredits";
import { assertOrgBudget } from "@/lib/credits";
import { isBudgetExceeded } from "@/lib/errors";
import { withErrors } from "@/lib/api";

/**
 * POST /api/leads/video/build — generate a video from the AI Video Prompt
 * Builder (see Instructions/videogenpromptgen.txt).
 *
 * ACCESS: signed-in (Clerk = verified) is required to reach any dashboard route;
 * this endpoint additionally gates the actual GENERATION behind a PAID plan
 * (active/trialing subscription) — platform admins pass for testing. Free users
 * can still build and copy the prompt in the UI, they just cannot generate here.
 *
 * The builder ships a fixed, production-grade negative prompt. Because
 * seedance_2_0 has no dedicated negative-prompt field, the negatives are folded
 * into the stored prompt as an "Avoid:" clause (the model honours it).
 *
 * Confirm-before-spend: without `confirmed` it returns the estimated credit
 * cost; with confirmed:true it budget-checks, creates a queued video asset on a
 * per-org "Video Studio" project, and wakes the runner. Body:
 * { positive: string, confirmed?: boolean }.
 */

// Fixed negative prompt — auto-injected, not editable by the user.
const FIXED_NEGATIVE =
  "text, typography, misspelled words, floating logos, watermark, morphing fingers, " +
  "extra limbs, disjointed joints, unrealistic physics, zero compression, rubbery movement, " +
  "blur, low quality";

const STUDIO_SLUG = "video-studio";

/** Find (or create) the org's dedicated Video Studio project for builder output. */
async function ensureStudioProject(orgId: string, userId: string) {
  const existing = await prisma.projects.findFirst({
    where: { org_id: orgId, slug: STUDIO_SLUG, deleted_at: null },
  });
  if (existing) return existing;
  return prisma.projects.create({
    data: {
      org_id: orgId,
      created_by: userId,
      name: "Video Studio",
      slug: STUDIO_SLUG,
      description: "Videos generated with the AI Video Prompt Builder.",
      template_type: "custom",
    },
  });
}

export const POST = withErrors(async (request: Request) => {
  const { user, org } = await getContext();

  // Access gate — the builder unlocks at the admin-set basic credit threshold
  // (admins pass for testing).
  const access = await resolveBuilderAccess(org, isPlatformAdmin(user.email));
  if (access.level === "none") {
    return NextResponse.json(
      {
        status: "upgrade-required",
        error: `Generating a video with the AI Prompt Builder needs a plan of at least ${access.basicMin} credits/month. Upgrade to unlock it.`,
      },
      { status: 402 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    positive?: unknown;
    negative?: unknown;
    confirmed?: unknown;
    resolution?: unknown;
    duration?: unknown;
    aspectRatio?: unknown;
    mode?: unknown;
    image?: unknown;
  };
  const positive = typeof body.positive === "string" ? body.positive.trim() : "";

  // Higgsfield generation params (validated + clamped to native values).
  const resolution = (["480p", "720p", "1080p"] as const).includes(body.resolution as never)
    ? (body.resolution as "480p" | "720p" | "1080p")
    : "720p";
  const durNum = Number(body.duration);
  const duration = Number.isFinite(durNum) ? Math.min(15, Math.max(4, Math.round(durNum))) : 6;
  const aspectRatio = (["16:9", "9:16", "1:1"] as const).includes(body.aspectRatio as never)
    ? (body.aspectRatio as "16:9" | "9:16" | "1:1")
    : "16:9";
  // A reference image switches to Image-to-Video. Accept only a small
  // png/jpeg/webp data URL; anything invalid or oversized falls back to t2v.
  const rawImage = typeof body.image === "string" ? body.image : "";
  const validImage =
    /^data:image\/(png|jpe?g|webp);base64,/.test(rawImage) && rawImage.length <= 2_800_000
      ? rawImage
      : "";
  const mode: "t2v" | "i2v" = body.mode === "i2v" && validImage ? "i2v" : "t2v";
  // The builder now compiles a dynamic negative prompt; fall back to the fixed
  // baseline if the client did not send one.
  const negative =
    typeof body.negative === "string" && body.negative.trim()
      ? body.negative.trim().slice(0, 2000)
      : FIXED_NEGATIVE;
  if (positive.length < 20) {
    return NextResponse.json(
      { error: "Build a fuller prompt before generating (add at least the subject and action)." },
      { status: 400 },
    );
  }
  if (positive.length > 4000) {
    return NextResponse.json({ error: "Prompt is too long." }, { status: 400 });
  }
  const confirmed = body.confirmed === true;

  // Real Higgsfield price for this resolution + duration (mirrors the runner's
  // resolution→mode mapping), not a flat estimate.
  const estimatedCredits = estimateVideoCredits(resolution, duration);

  if (!confirmed) {
    return NextResponse.json({
      status: "confirmation-required",
      estimatedCredits,
      estimate: "approximate",
    });
  }

  // Budget check against the org's shared Higgsfield pool.
  try {
    await assertOrgBudget(org.id, estimatedCredits);
  } catch (e) {
    if (isBudgetExceeded(e)) {
      return NextResponse.json({ status: "budget-exceeded", message: e.message }, { status: 200 });
    }
    throw e;
  }

  const project = await ensureStudioProject(org.id, user.id);

  // Fold the negative in as an "Avoid:" clause (seedance has no negative field).
  const storedPrompt = `${positive}\n\nAvoid: ${negative}`;

  const asset = await prisma.assets.create({
    data: {
      project_id: project.id,
      created_by: user.id,
      type: "video",
      name: "AI Prompt Builder video",
      prompt: storedPrompt,
      status: "queued",
      metadata: {
        source: "prompt-builder",
        negative,
        // Runner reads `requested` to emit the Higgsfield CLI flags. Model is
        // env-overridable: default seedance_2_0 works on the Starter plan;
        // set HIGGSFIELD_VIDEO_MODEL=seedance_2_5 once on a Pro/Ultimate plan.
        requested: {
          model: process.env.HIGGSFIELD_VIDEO_MODEL || "seedance_2_0",
          resolution,
          duration,
          aspectRatio,
          mode,
        },
        ...(mode === "i2v" ? { imageDataUrl: validImage } : {}),
      },
    },
  });

  await triggerRunner("generate");

  return NextResponse.json({
    status: "queued",
    assetId: asset.id,
    projectId: project.id,
    estimatedCredits,
  });
});
