import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_TYPES = ["image", "video", "email", "social"] as const;
type AssetType = (typeof ASSET_TYPES)[number];

type Ctx = { params: { id: string } };

async function ensureProject(id: string, orgId: string) {
  if (!UUID.test(id)) return null;
  return prisma.projects.findFirst({ where: { id, org_id: orgId, deleted_at: null } });
}

/** GET /api/projects/[id]/assets — list a project's assets (newest first). */
export const GET = withErrors<Ctx>(async (_request, { params }) => {
  const { org } = await getContext();
  const project = await ensureProject(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const assets = await prisma.assets.findMany({
    where: { project_id: project.id },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json({ assets });
});

/**
 * POST /api/projects/[id]/assets — create an asset request (draft).
 * Body: { type, name?, prompt? }. Media (image/video) is generated via the
 * confirm-gated `[assetId]/generate` endpoint → the runner. Copy lives in the
 * Emails / Social sections.
 */
export const POST = withErrors<Ctx>(async (request, { params }) => {
  const { user, org } = await getContext();
  const project = await ensureProject(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    type?: unknown;
    name?: unknown;
    prompt?: unknown;
  };
  const type = (typeof body.type === "string" ? body.type : "") as AssetType;
  if (!ASSET_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${ASSET_TYPES.join(", ")}.` },
      { status: 400 },
    );
  }
  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : `Untitled ${type}`;
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : null;

  const asset = await prisma.assets.create({
    data: { project_id: project.id, created_by: user.id, type, name, prompt, status: "draft" },
  });
  return NextResponse.json({ asset, generation: "draft" }, { status: 201 });
});
