import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { triggerRunner } from "@/lib/jobs";
import { activeProvider } from "@/lib/generation/adapter";
import { assertOrgBudget } from "@/lib/credits";
import { isBudgetExceeded } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * POST /api/presence-kit — the one-button AI Presence Kit (Module 1).
 *
 * Input a business; the kit orchestrates, in ONE dispatch to the GitHub Actions
 * runner: a landing page (Claude HTML, 0 Higgsfield credits) + social graphics
 * and a short video (Higgsfield, URL-only). All rows are org-scoped (tenant).
 * Generation never runs in-request — rows are created `queued` and the runner
 * fulfils them (cron safety-net + an explicit nudge). Confirm-before-spend:
 * without `confirmed`, returns the credit estimate for the media; with
 * `confirmed:true`, gates on the per-org budget (the 200-credit/month cap is
 * enforced there) and queues.
 *
 * Body: { businessName, category?, location?, phone?, contacts?, photoUrls?,
 *         googlePlaceUrl?, confirmed? }
 */

// Conservative defaults — the binding constraint today is the 200-credit/month
// Higgsfield cap, so a kit stays modest (3 graphics + 1 short video ≈ 51 cr).
const KIT_MEDIA: { images: number; videos: number } = { images: 3, videos: 1 };

type NewContact = { name?: string; email?: string };

const s = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** A short, on-brand asset prompt derived from the business inputs. */
function assetPrompt(
  kind: "image" | "video",
  biz: { name: string; category: string; location: string },
  idx: number,
): string {
  const who = [biz.category, biz.location].filter(Boolean).join(" in ") || "local business";
  if (kind === "video") {
    return `A short, upbeat social video ad for "${biz.name}", a ${who}. Clean, modern, mobile-first vertical format; highlight the business and a clear call to action. No on-screen text artifacts.`;
  }
  const angles = [
    `a hero social graphic for "${biz.name}", a ${who} — bold, premium, mobile-first`,
    `a square social post for "${biz.name}" (${who}) — clean, high-contrast, brand-forward`,
    `a promotional banner for "${biz.name}" (${who}) — minimal, modern, lots of clear space`,
  ];
  return `Create ${angles[idx % angles.length]}. Photographic, professional, no distracting text.`;
}

export const GET = withErrors<unknown>(async () => {
  const { org } = await getContext();
  const kits = await prisma.presence_kits.findMany({
    where: { org_id: org.id },
    orderBy: { created_at: "desc" },
    select: {
      id: true, status: true, business_name: true, category: true, location: true,
      landing_page_id: true, asset_ids: true, error: true, created_at: true, updated_at: true,
    },
  });
  return NextResponse.json({
    kits: kits.map((k) => ({
      id: k.id, status: k.status, businessName: k.business_name,
      category: k.category, location: k.location,
      landingPageId: k.landing_page_id, assetIds: k.asset_ids, error: k.error,
      createdAt: k.created_at.toISOString(), updatedAt: k.updated_at.toISOString(),
    })),
  });
});

export const POST = withErrors<unknown>(async (request) => {
  const { user, org } = await getContext();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const businessName = s(body.businessName, 160);
  if (!businessName) {
    return NextResponse.json({ error: "A business name is required." }, { status: 400 });
  }
  const category = s(body.category, 120);
  const location = s(body.location, 160);
  const phone = s(body.phone, 40);
  const googlePlaceUrl = s(body.googlePlaceUrl, 1000);
  const photoUrls = Array.isArray(body.photoUrls)
    ? (body.photoUrls as unknown[]).filter((u): u is string => typeof u === "string").slice(0, 10)
    : [];
  const contacts = Array.isArray(body.contacts)
    ? (body.contacts as NewContact[])
        .map((c) => ({ name: s(c?.name, 120), email: s(c?.email, 200) }))
        .filter((c) => c.email)
        .slice(0, 50)
    : [];
  const confirmed = body.confirmed === true;

  // Confirm-before-spend: estimate the Higgsfield media cost (landing = 0 cr).
  const provider = activeProvider();
  const estimatedCredits =
    KIT_MEDIA.images * provider.creditEstimate("image") +
    KIT_MEDIA.videos * provider.creditEstimate("video");

  if (!confirmed) {
    return NextResponse.json({
      status: "confirmation-required",
      estimatedCredits,
      breakdown: {
        images: { count: KIT_MEDIA.images, each: provider.creditEstimate("image") },
        videos: { count: KIT_MEDIA.videos, each: provider.creditEstimate("video") },
        landingPage: 0,
      },
      provider: provider.id,
    });
  }

  try {
    await assertOrgBudget(org.id, estimatedCredits);
  } catch (e) {
    if (isBudgetExceeded(e)) {
      return NextResponse.json({ status: "budget-exceeded", message: e.message }, { status: 200 });
    }
    throw e;
  }

  const biz = { name: businessName, category, location };
  const niche = category || "general";

  // One project per kit (the business lives as a ClientProfile on it).
  const slugBase =
    businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) ||
    "business";
  const project = await prisma.projects.create({
    data: {
      org_id: org.id, created_by: user.id,
      name: `${businessName} — Presence Kit`,
      slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}`,
      description: [category, location].filter(Boolean).join(" · ") || null,
      template_type: "presence-kit",
    },
    select: { id: true },
  });

  await prisma.clientProfile.create({
    data: {
      org_id: org.id, project_id: project.id,
      company_name: businessName, metro_area: location || "—", niche,
      phone: phone || null,
      brand_guidelines: photoUrls.length ? { photoUrls } : undefined,
    },
  }).catch(() => { /* non-fatal: the kit still generates without a profile row */ });

  // Landing page (Claude, 0 Higgsfield credits) — runner renders the HTML.
  const brief = [
    `Business: ${businessName}`,
    category && `Category: ${category}`,
    location && `Location: ${location}`,
    phone && `Phone: ${phone}`,
    googlePlaceUrl && `Google listing: ${googlePlaceUrl}`,
    `Goal: a credible, mobile-first one-page web presence that gets this local business found and contacted.`,
  ].filter(Boolean).join("\n");

  const page = await prisma.landing_pages.create({
    data: { org_id: org.id, project_id: project.id, created_by: user.id, title: businessName, brief, status: "queued" },
    select: { id: true },
  });

  // Media assets (Higgsfield via the runner) — queued; runner records spend.
  const assetRows = [
    ...Array.from({ length: KIT_MEDIA.images }, (_, i) => ({
      type: "image", name: `${businessName} — graphic ${i + 1}`, prompt: assetPrompt("image", biz, i),
    })),
    ...Array.from({ length: KIT_MEDIA.videos }, (_, i) => ({
      type: "video", name: `${businessName} — video ${i + 1}`, prompt: assetPrompt("video", biz, i),
    })),
  ];
  const assetIds: string[] = [];
  for (const a of assetRows) {
    const row = await prisma.assets.create({
      data: { project_id: project.id, created_by: user.id, type: a.type, name: a.name, prompt: a.prompt, status: "queued" },
      select: { id: true },
    });
    assetIds.push(row.id);
  }

  const kit = await prisma.presence_kits.create({
    data: {
      org_id: org.id, project_id: project.id, created_by: user.id,
      business_name: businessName, category: category || null, location: location || null,
      inputs: { phone, googlePlaceUrl, photoUrls, contacts },
      landing_page_id: page.id, asset_ids: assetIds, status: "generating",
    },
    select: { id: true, status: true },
  });

  // One nudge to the runner; the cron safety-net also picks up queued rows.
  await triggerRunner("generate");

  return NextResponse.json(
    {
      kit: { id: kit.id, status: kit.status },
      projectId: project.id,
      landingPageId: page.id,
      assetIds,
      estimatedCredits,
      contactsQueuedForReview: contacts.length,
    },
    { status: 201 },
  );
});
