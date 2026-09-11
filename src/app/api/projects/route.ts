import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "edge";

/** GET /api/projects — list the current org's non-deleted projects (newest first). */
export async function GET() {
  const { org } = await getContext();
  const projects = await prisma.projects.findMany({
    where: { org_id: org.id, deleted_at: null },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json({ projects });
}

/** POST /api/projects — create a project in the current org. Body: { name, description? } */
export async function POST(request: Request) {
  const { user, org } = await getContext();
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    description?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) ||
    "project";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  const project = await prisma.projects.create({
    data: { org_id: org.id, created_by: user.id, name, description, slug },
  });
  return NextResponse.json({ project }, { status: 201 });
}
