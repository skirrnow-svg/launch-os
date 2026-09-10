import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/claude";
import { isMissingKey } from "@/lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: { id: string; campaignId: string } };

/** Load a campaign only if it belongs to a project in the caller's org. */
async function loadCampaign(id: string, campaignId: string, orgId: string) {
  if (!UUID.test(id) || !UUID.test(campaignId)) return null;
  const project = await prisma.projects.findFirst({
    where: { id, org_id: orgId, deleted_at: null },
  });
  if (!project) return null;
  return prisma.email_campaigns.findFirst({
    where: { id: campaignId, project_id: project.id },
  });
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
 * { generate: true, brief?: string } to have Claude write the subject + body.
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

  let generation: string | undefined;
  if (body.generate === true) {
    const brief =
      typeof body.brief === "string" && body.brief.trim()
        ? body.brief.trim()
        : `Campaign: ${existing.name}. Current subject: ${existing.subject}.`;
    try {
      const out = await generateText({
        orgId: org.id,
        system:
          "You are a senior launch email copywriter. Given a brief, return ONLY a JSON object " +
          '{"subject": string, "html": string} — a compelling subject line and a complete, ' +
          "well-structured HTML email body (inline-friendly, no <html>/<head> wrapper). No prose outside the JSON.",
        prompt: brief,
        maxTokens: 1500,
      });
      const parsed = parseEmail(out);
      if (parsed.subject) data.subject = parsed.subject;
      if (parsed.html) data.template_html = parsed.html;
      generation = "ready";
    } catch (e) {
      if (isMissingKey(e)) generation = "not-configured";
      else generation = "error";
    }
  }

  if (Object.keys(data).length === 0 && !generation) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const campaign =
    Object.keys(data).length > 0
      ? await prisma.email_campaigns.update({ where: { id: existing.id }, data })
      : existing;

  return NextResponse.json({ campaign, generation });
}

/** Best-effort parse of Claude's JSON email; falls back to treating text as HTML. */
function parseEmail(text: string): { subject?: string; html?: string } {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const obj = JSON.parse(trimmed) as { subject?: unknown; html?: unknown };
    return {
      subject: typeof obj.subject === "string" ? obj.subject : undefined,
      html: typeof obj.html === "string" ? obj.html : undefined,
    };
  } catch {
    return { html: `<div>${trimmed}</div>` };
  }
}
