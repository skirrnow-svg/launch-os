import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: { id: string } };

async function ensureProject(id: string, orgId: string) {
  if (!UUID.test(id)) return null;
  return prisma.projects.findFirst({ where: { id, org_id: orgId, deleted_at: null } });
}

/** GET /api/projects/[id]/emails — list a project's email campaigns. */
export async function GET(_request: Request, { params }: Ctx) {
  const { org } = await getContext();
  const project = await ensureProject(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const campaigns = await prisma.email_campaigns.findMany({
    where: { project_id: project.id },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json({ campaigns });
}

/**
 * POST /api/projects/[id]/emails — create a draft email campaign.
 * Body: { name, subject? }. Sender/template are seeded with placeholders the
 * user edits later. TODO(phase-3): real template editor + Resend send.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { user, org } = await getContext();
  const project = await ensureProject(params.id, org.id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; subject?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
  const subject =
    typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : name;

  const campaign = await prisma.email_campaigns.create({
    data: {
      project_id: project.id,
      created_by: user.id,
      name,
      subject,
      from_name: org.name,
      from_email: "launch@example.com", // TODO(phase-3): verified sender per org
      template_html: "<p>Draft — edit your email content.</p>",
      status: "draft",
    },
  });
  return NextResponse.json({ campaign }, { status: 201 });
}
