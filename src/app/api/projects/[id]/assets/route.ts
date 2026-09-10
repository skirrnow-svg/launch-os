import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/claude";
import { isMissingKey } from "@/lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_TYPES = ["image", "video", "email", "social"] as const;
type AssetType = (typeof ASSET_TYPES)[number];

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

/** Ask Claude to turn a rough idea into a production brief / copy. */
function briefSystemPrompt(type: AssetType): string {
  switch (type) {
    case "email":
      return "You are a senior launch copywriter. Write a concise marketing email (subject line + short body) for the described launch. Plain text.";
    case "social":
      return "You are a senior social media copywriter. Write 3 short, punchy post variants for the described launch. Plain text, one per line.";
    case "image":
      return "You are an art director. Turn the idea into ONE vivid image-generation prompt (subject, style, lighting, composition). Return only the prompt.";
    case "video":
      return "You are a video director. Turn the idea into ONE concise video-generation prompt (scene, motion, mood, duration). Return only the prompt.";
  }
}

/**
 * POST /api/projects/[id]/assets — create an asset request, optionally generating.
 * Body: { type, name?, prompt?, generate?: boolean, confirmed?: boolean }
 *
 * Always records the request as a draft asset (real workflow + history). When
 * `generate` is set and keys are configured:
 *  - email/social: Claude writes the copy → stored on the asset, status 'ready'.
 *  - image/video : Claude refines the generation prompt; media generation is
 *    gated by the Higgsfield credit guardrail (estimate + explicit confirm),
 *    so it only runs when `confirmed` is passed and a key exists.
 * Missing keys / needed confirmation are reported without failing the request.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { user, org } = await getContext();
  const project = await ensureProject(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    type?: unknown;
    name?: unknown;
    prompt?: unknown;
    generate?: unknown;
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
  const wantGenerate = body.generate === true;

  let asset = await prisma.assets.create({
    data: { project_id: project.id, created_by: user.id, type, name, prompt, status: "draft" },
  });

  if (!wantGenerate) {
    return NextResponse.json({ asset, generation: "draft" }, { status: 201 });
  }
  if (!prompt) {
    return NextResponse.json(
      { asset, generation: "needs-prompt", message: "Add a prompt to generate." },
      { status: 201 },
    );
  }

  // --- Generation path ------------------------------------------------------
  try {
    const brief = await generateText({
      orgId: org.id,
      system: briefSystemPrompt(type),
      prompt,
      maxTokens: 1024,
    });

    if (type === "email" || type === "social") {
      // Text deliverable is complete once Claude returns.
      asset = await prisma.assets.update({
        where: { id: asset.id },
        data: { description: brief, status: "ready", error_message: null },
      });
      return NextResponse.json({ asset, generation: "ready" }, { status: 201 });
    }

    // image / video: Claude refined the media prompt. The actual (paid) media
    // generation happens via the confirm-gated endpoint
    // POST /api/projects/[id]/assets/[assetId]/generate — never here.
    asset = await prisma.assets.update({
      where: { id: asset.id },
      data: { prompt: brief, description: `Refined ${type} prompt ready — use Generate to create media.`, status: "draft" },
    });
    return NextResponse.json({ asset, generation: "prompt-ready" }, { status: 201 });
  } catch (err) {
    if (isMissingKey(err)) {
      await prisma.assets.update({
        where: { id: asset.id },
        data: { error_message: err.message },
      });
      return NextResponse.json(
        { asset, generation: "not-configured", message: err.message },
        { status: 201 },
      );
    }
    const message = err instanceof Error ? err.message : "Generation failed.";
    await prisma.assets.update({
      where: { id: asset.id },
      data: { status: "error", error_message: message },
    });
    return NextResponse.json({ asset, generation: "error", message }, { status: 201 });
  }
}
