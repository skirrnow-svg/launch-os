import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: { id: string } };

/** Fetch a project only if it belongs to the caller's org and isn't deleted. */
async function findScoped(id: string, orgId: string) {
  if (!UUID.test(id)) return null;
  return prisma.projects.findFirst({ where: { id, org_id: orgId, deleted_at: null } });
}

export async function GET(_request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const project = await findScoped(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const existing = await findScoped(params.id, org.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    description?: unknown;
    status?: unknown;
  };
  const data: { name?: string; description?: string | null; status?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.status === "string" && body.status.trim()) data.status = body.status.trim();
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const project = await prisma.projects.update({ where: { id: existing.id }, data });
  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const existing = await findScoped(params.id, org.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await prisma.projects.update({ where: { id: existing.id }, data: { deleted_at: new Date() } });
  return NextResponse.json({ ok: true });
}
