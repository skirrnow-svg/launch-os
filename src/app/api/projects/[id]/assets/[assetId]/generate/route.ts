import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { modelFor, triggerRunner } from "@/lib/jobs";
import { creditCostFor } from "@/lib/billing/actionCosts";
import { assertOrgBudget } from "@/lib/credits";
import { isBudgetExceeded } from "@/lib/errors";
import { withErrors } from "@/lib/api";


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: { id: string; assetId: string } };
type Kind = "image" | "video";

async function loadAsset(id: string, assetId: string, orgId: string) {
  if (!UUID.test(id) || !UUID.test(assetId)) return null;
  const project = await prisma.projects.findFirst({
    where: { id, org_id: orgId, deleted_at: null },
  });
  if (!project) return null;
  return prisma.assets.findFirst({ where: { id: assetId, project_id: project.id } });
}

/**
 * POST /api/projects/[id]/assets/[assetId]/generate — enqueue media generation.
 *
 * The web tier never runs the CLI (it's edge). Without `confirmed` it returns
 * an approximate credit cost to confirm; with confirmed:true it checks the
 * per-org budget, marks the asset `queued`, and wakes the GitHub Actions runner
 * (which runs Higgsfield and writes the result back). Body: { confirmed? }.
 */
export const POST = withErrors<Ctx>(async (request, { params }) => {
  const { org } = await getContext();
  const asset = await loadAsset(params.id, params.assetId, org.id);
  if (!asset) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (asset.type !== "image" && asset.type !== "video") {
    return NextResponse.json({ error: "Only image/video assets generate media." }, { status: 400 });
  }
  if (!asset.prompt?.trim()) {
    return NextResponse.json({ error: "This asset has no prompt yet." }, { status: 400 });
  }

  const kind = asset.type as Kind;
  const body = (await request.json().catch(() => ({}))) as { confirmed?: unknown };
  const confirmed = body.confirmed === true;
  const estimatedCredits = await creditCostFor(kind);

  if (!confirmed) {
    return NextResponse.json({
      status: "confirmation-required",
      estimatedCredits,
      model: modelFor(kind),
      estimate: "approximate",
    });
  }

  try {
    await assertOrgBudget(org.id, estimatedCredits);
  } catch (e) {
    if (isBudgetExceeded(e)) {
      return NextResponse.json({ status: "budget-exceeded", message: e.message }, { status: 200 });
    }
    throw e;
  }

  const queued = await prisma.assets.update({
    where: { id: asset.id },
    data: { status: "queued", error_message: null },
  });
  await triggerRunner("generate");
  return NextResponse.json({ status: "queued", asset: queued });
});
