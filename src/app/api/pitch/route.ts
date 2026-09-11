import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { ingestLead } from "@/lib/leads";
import { withErrors } from "@/lib/api";

/**
 * POST /api/pitch — the Instant Pitch Generator.
 *
 * Authenticated + org-scoped (unlike the public /get-started funnel). The
 * operator describes a prospect directly; we create a well-formed lead in the
 * ACTIVE org and run the same qualify → verify → legal → sample-copy path.
 * `autoVideo:false` means the runner produces copy only — the concept video is
 * a separate, cost-previewed action, so a pitch never auto-spends credits.
 *
 * Body: { company, niche, offer, metro?, phone?, email? }.
 */
export const POST = withErrors<unknown>(async (request) => {
  const { org } = await getContext();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const company = s("company");
  const niche = s("niche");
  const offer = s("offer");
  const metro = s("metro");
  const phone = s("phone");
  const email = s("email");

  if (!company) {
    return NextResponse.json({ error: "A company or brand name is required." }, { status: 400 });
  }
  if (!offer) {
    return NextResponse.json(
      { error: "Describe the offer or product so we can qualify and write the ad." },
      { status: 400 },
    );
  }

  // A contact email is optional for a pitch; derive a stable placeholder so the
  // lead record and generation briefs have something to reference.
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "prospect";
  const leadEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : `pitch+${slug}@skirrnow.local`;

  const lines = [
    `Company: ${company}`,
    niche && `Niche: ${niche}`,
    metro && `Metro area: ${metro}`,
    phone && `Phone: ${phone}`,
    `\nOffer: ${offer}`,
  ].filter(Boolean);

  const result = await ingestLead({
    orgId: org.id,
    email: leadEmail,
    subject: `Pitch: ${company}`,
    body: lines.join("\n"),
    forceInterested: true,
    source: "pitch",
    autoVideo: false,
  });

  return NextResponse.json({ ok: true, lead_id: result.lead_id, dispatched: result.dispatched });
});
