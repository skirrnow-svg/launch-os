import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { getCreationTokenCosts, CREATION_TOKEN_COST } from "@/lib/billing/creationCosts";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only editor for the Brand Studio per-creation SkirrNow AI-token cost.
 * GET   → { image, video, defaults }.
 * PATCH → { image?, video? } (non-negative integers) upserts platform_settings.
 */
function forbidden(e: unknown) {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  throw e;
}

function intOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

export const GET = withErrors<unknown>(async () => {
  try {
    await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const costs = await getCreationTokenCosts();
  return NextResponse.json({ ...costs, defaults: CREATION_TOKEN_COST });
});

export const PATCH = withErrors<unknown>(async (request) => {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const image = intOrUndef(body.image);
  const video = intOrUndef(body.video);
  if (image === undefined && video === undefined) {
    return NextResponse.json({ error: "Provide a non-negative image and/or video token cost." }, { status: 400 });
  }
  const data: { brand_image_tokens?: number; brand_video_tokens?: number; updated_at: Date } = { updated_at: new Date() };
  if (image !== undefined) data.brand_image_tokens = image;
  if (video !== undefined) data.brand_video_tokens = video;

  await prisma.platform_settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: "brandTokens.update", resourceType: "brandTokens", changes: { image, video } });

  const costs = await getCreationTokenCosts();
  return NextResponse.json({ ok: true, ...costs, defaults: CREATION_TOKEN_COST });
});
