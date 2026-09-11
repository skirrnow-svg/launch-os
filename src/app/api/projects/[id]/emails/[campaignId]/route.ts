import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { triggerRunner } from "@/lib/jobs";

export const runtime = "edge";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: { id: string; campaignId: string } };

async function loadCampaign(id: string, campaignId: string, orgId: string) {
  if (!UUID.test(id) || !UUID.test(campaignId)) return null;
  const project = await prisma.projects.findFirst({
    where: { id, org_id: orgId, deleted_at: null },
  });
  if (!project) return null;
  return prisma.email_campaigns.findFirst({ where: { id: campaignId, project_id: project.id } });
}

/** GET one campaign. */
export async function GET(_req: Request, { params }: Ctx) {
  const { org } = await getContext();
  const campaign = await loadCampaign(params.id, params.campaignId, org.id);
  if (!campaign) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ campaign });
}

/**
 * PATCH one campaign.
 * Body: { name?, subject?, template_html?, plain_text? } to edit, and/or
 * { generate:true, brief? } to enqueue copy generation — the web tier is edge
 * and can't run `claude`, so it stores the brief, marks the campaign `queued`,
 * and wakes the runner (which writes the subject + HTML body).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { org } = await getContext();
  const existing = await loadCampaign(params.id, params.campaignId, org.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    subject?: unknown;
    template_html?: unknown;
    plain_text?: unknown;
    generate?: unknown;
    brief?: unknown;
  };

  const data: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.subject === "string") data.subject = body.subject.trim() || existing.subject;
  if (typeof body.template_html === "string") data.template_html = body.template_html;
  if (typeof body.plain_text === "string") data.plain_text = body.plain_text;

  if (body.generate === true) {
    const brief =
      typeof body.brief === "string" && body.brief.trim()
        ? body.brief.trim()
        : `Campaign: ${existing.name}. Current subject: ${existing.subject}.`;
    const campaign = await prisma.email_campaigns.update({
      where: { id: existing.id },
      data: { ...data, generation_brief: brief, status: "queued" },
    });
    await triggerRunner("generate");
    return NextResponse.json({ campaign, generation: "queued" });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const campaign = await prisma.email_campaigns.update({ where: { id: existing.id }, data });
  return NextResponse.json({ campaign });
}
