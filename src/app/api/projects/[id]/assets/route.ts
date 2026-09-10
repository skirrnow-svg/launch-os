import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_TYPES = ["image", "video", "email", "social"];

type Ctx = { params: { id: string } };

async function ensureProject(id: string, orgId: string) {
  if (!UUID.test(id)) return null;
  return prisma.projects.findFirst({ where: { id, org_id: orgId, deleted_at: null } });
}

/** GET /api/projects/[id]/assets — list a project's assets (newest first). */
export async function GET(_request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const project = await ensureProject(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const assets = await prisma.assets.findMany({
    where: { project_id: project.id },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json({ assets });
}

/**
 * POST /api/projects/[id]/assets — request a new AI asset.
 * Body: { type: image|video|email|social, name?, prompt? }
 *
 * TODO(phase-2): once CLAUDE_API_KEY + HIGGSFIELD_API_KEY (and the higgsfield
 * CLI) are configured, this should: refine the prompt via Claude, generate the
 * media via Higgsfield (RESPECTING the credit guardrails — estimate cost and
 * confirm before any generation, never autonomous >25-credit hi-res video),
 * upload the result to R2, and set url + status='ready'. For now it records the
 * request as a 'draft' asset so the workflow and history are real.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { user, org } = await getContext();
  const project = await ensureProject(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    type?: unknown;
    name?: unknown;
    prompt?: unknown;
  };
  const type = typeof body.type === "string" ? body.type : "";
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
  return NextResponse.json({ asset, generation: "pending-integration" }, { status: 201 });
}
