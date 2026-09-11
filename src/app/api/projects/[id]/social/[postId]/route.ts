import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerRunner } from "@/lib/jobs";

export const runtime = "edge";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORMS = ["twitter", "linkedin", "instagram", "facebook"];
type Ctx = { params: { id: string; postId: string } };

async function loadPost(id: string, postId: string, orgId: string) {
  if (!UUID.test(id) || !UUID.test(postId)) return null;
  const project = await prisma.projects.findFirst({
    where: { id, org_id: orgId, deleted_at: null },
  });
  if (!project) return null;
  return prisma.social_posts.findFirst({ where: { id: postId, project_id: project.id } });
}

/** GET one post. */
export async function GET(_req: Request, { params }: Ctx) {
  const { org } = await getContext();
  const post = await loadPost(params.id, params.postId, org.id);
  if (!post) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ post });
}

/**
 * PATCH one post.
 * Body: { content?, platforms?, hashtags? } to edit, and/or { generate:true,
 * brief? } to enqueue copy generation. The edge web tier can't run `claude`, so
 * it stores the brief, marks the post `queued`, and wakes the runner.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { org } = await getContext();
  const existing = await loadPost(params.id, params.postId, org.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    content?: unknown;
    platforms?: unknown;
    hashtags?: unknown;
    generate?: unknown;
    brief?: unknown;
  };

  const data: { content?: string; platforms?: string[]; hashtags?: string[]; generation_brief?: string; status?: string } = {};
  if (typeof body.content === "string") data.content = body.content;
  if (Array.isArray(body.platforms)) {
    data.platforms = body.platforms.filter(
      (p): p is string => typeof p === "string" && PLATFORMS.includes(p),
    );
  }
  if (Array.isArray(body.hashtags)) {
    data.hashtags = body.hashtags
      .filter((h): h is string => typeof h === "string")
      .map((h) => h.replace(/^#/, "").trim())
      .filter(Boolean);
  }

  if (body.generate === true) {
    const targets = (data.platforms ?? existing.platforms).join(", ") || "social media";
    const brief =
      typeof body.brief === "string" && body.brief.trim()
        ? body.brief.trim()
        : existing.content || "Announce our launch.";
    data.generation_brief = `Platforms: ${targets}. ${brief}`;
    data.status = "queued";
    const post = await prisma.social_posts.update({ where: { id: existing.id }, data });
    await triggerRunner("generate");
    return NextResponse.json({ post, generation: "queued" });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const post = await prisma.social_posts.update({ where: { id: existing.id }, data });
  return NextResponse.json({ post });
}
