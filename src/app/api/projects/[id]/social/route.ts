import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORMS = ["twitter", "linkedin", "instagram", "facebook"];
type Ctx = { params: { id: string } };

async function ensureProject(id: string, orgId: string) {
  if (!UUID.test(id)) return null;
  return prisma.projects.findFirst({ where: { id, org_id: orgId, deleted_at: null } });
}

/** GET /api/projects/[id]/social — list a project's social posts. */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { org } = await getContext();
    const project = await ensureProject(params.id, org.id);
    if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const posts = await prisma.social_posts.findMany({
      where: { project_id: project.id },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ posts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load posts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/social — create a draft social post.
 * Body: { content, platforms?: string[] }. TODO(phase-2): Buffer scheduling.
 */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user, org } = await getContext();
    const project = await ensureProject(params.id, org.id);
    if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      content?: unknown;
      platforms?: unknown;
    };
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ error: "Post content is required." }, { status: 400 });
    const platforms = Array.isArray(body.platforms)
      ? body.platforms.filter((p): p is string => typeof p === "string" && PLATFORMS.includes(p))
      : [];

    const post = await prisma.social_posts.create({
      data: { project_id: project.id, created_by: user.id, content, platforms, status: "draft" },
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create post.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
