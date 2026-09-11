import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generate,
  estimateCost,
  higgsfieldConfigured,
  modelFor,
  type HiggsfieldKind,
} from "@/lib/higgsfield";
import { isConfirmationRequired } from "@/lib/errors";
import { generationMode, staticCreditEstimate, triggerRunner } from "@/lib/jobs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: { id: string; assetId: string } };

async function loadAsset(id: string, assetId: string, orgId: string) {
  if (!UUID.test(id) || !UUID.test(assetId)) return null;
  const project = await prisma.projects.findFirst({
    where: { id, org_id: orgId, deleted_at: null },
  });
  if (!project) return null;
  return prisma.assets.findFirst({ where: { id: assetId, project_id: project.id } });
}

/**
 * POST /api/projects/[id]/assets/[assetId]/generate — generate the media for an
 * image/video asset via Higgsfield, ENFORCING the credit guardrail.
 *
 * Body: { confirmed?: boolean }.
 *  - Without confirmed: prices the job (no spend) and returns
 *    { status:'confirmation-required', estimatedCredits, model } — the UI shows
 *    the cost and asks. This is the owner rule: confirm before ANY spend.
 *  - With confirmed:true: runs it, stores the result URL, marks asset 'ready'.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const asset = await loadAsset(params.id, params.assetId, org.id);
  if (!asset) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (asset.type !== "image" && asset.type !== "video") {
    return NextResponse.json({ error: "Only image/video assets generate media." }, { status: 400 });
  }
  const prompt = asset.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "This asset has no prompt yet." }, { status: 400 });
  }

  const kind = asset.type as HiggsfieldKind;
  const body = (await request.json().catch(() => ({}))) as { confirmed?: unknown };
  const confirmed = body.confirmed === true;

  // Queue mode (Cloudflare Pages): no CLI here. Show a CLI-free estimate, then
  // on confirmation mark the row `queued` and wake the Actions runner.
  if (generationMode() === "queue") {
    if (!confirmed) {
      return NextResponse.json({
        status: "confirmation-required",
        estimatedCredits: staticCreditEstimate(kind),
        model: modelFor(kind),
        estimate: "approximate",
      });
    }
    const queued = await prisma.assets.update({
      where: { id: asset.id },
      data: { status: "queued", error_message: null },
    });
    await triggerRunner("generate");
    return NextResponse.json({ status: "queued", asset: queued });
  }

  // Inline mode (local / the runner itself): the CLI is present.
  if (!(await higgsfieldConfigured())) {
    return NextResponse.json(
      { status: "not-configured", message: "Higgsfield CLI is not installed or authenticated on the host." },
      { status: 200 },
    );
  }

  // Price-only path: no spend, just return the estimate to confirm against.
  if (!confirmed) {
    try {
      const estimatedCredits = await estimateCost(kind, prompt);
      return NextResponse.json({
        status: "confirmation-required",
        estimatedCredits,
        model: modelFor(kind),
      });
    } catch (e) {
      return NextResponse.json(
        { status: "error", message: e instanceof Error ? e.message : "Could not price the job." },
        { status: 200 },
      );
    }
  }

  // Confirmed spend.
  try {
    await prisma.assets.update({ where: { id: asset.id }, data: { status: "generating", error_message: null } });
    const result = await generate({ orgId: org.id, kind, prompt, confirmed: true });
    const updated = await prisma.assets.update({
      where: { id: asset.id },
      data: {
        url: result.url,
        storage_key: result.storageKey,
        status: "ready",
        metadata: { model: result.model, creditsUsed: result.creditsUsed },
      },
    });
    return NextResponse.json({ status: "ready", asset: updated, creditsUsed: result.creditsUsed, model: result.model });
  } catch (e) {
    if (isConfirmationRequired(e)) {
      // Shouldn't happen (we passed confirmed), but surface the cost if it does.
      return NextResponse.json(
        { status: "confirmation-required", estimatedCredits: e.estimatedCredits, message: e.message },
        { status: 200 },
      );
    }
    const message = e instanceof Error ? e.message : "Generation failed.";
    await prisma.assets.update({ where: { id: asset.id }, data: { status: "error", error_message: message } });
    return NextResponse.json({ status: "error", message }, { status: 200 });
  }
}
