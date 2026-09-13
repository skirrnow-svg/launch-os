import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * A single landing page. GET returns its status + generated HTML (for preview);
 * DELETE removes it (freeing a quota slot). Org-scoped.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: { id: string; pageId: string } };

async function find(projectId: string, pageId: string, orgId: string) {
  if (!UUID.test(projectId) || !UUID.test(pageId)) return null;
  return prisma.landing_pages.findFirst({ where: { id: pageId, project_id: projectId, org_id: orgId } });
}

export async function GET(_request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const page = await find(params.id, params.pageId, org.id);
  if (!page) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({
    id: page.id, title: page.title, brief: page.brief, status: page.status,
    error: page.error, html: page.html, createdAt: page.created_at.toISOString(), updatedAt: page.updated_at.toISOString(),
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const page = await find(params.id, params.pageId, org.id);
  if (!page) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await prisma.landing_pages.delete({ where: { id: page.id } });
  return NextResponse.json({ ok: true });
}
