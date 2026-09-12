import { NextResponse } from "next/server";
import { getContext, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";

export const runtime = "nodejs";

/**
 * PATCH /api/org/branding — white-label branding for the active org.
 *
 * Agency feature: only an org whose account_type is 'agency' (or a platform
 * admin) may set branding. The logo is accepted as a data: URL image and stored
 * inline (capped); brand name + accent color are plain strings. These drive the
 * client-facing surfaces (reports header, sidebar) so an agency can present the
 * workspace as their own.
 *
 * Body: { brandName?, brandColor?, logoUrl?, clearLogo? }.
 */
const MAX_LOGO_BYTES = 400_000; // ~400KB data URL
const DATA_IMG = /^data:image\/(png|jpeg|jpg|webp|svg\+xml|gif);base64,[A-Za-z0-9+/=]+$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export const PATCH = withErrors<unknown>(async (request) => {
  const { user, org } = await getContext();
  const isAgency = org.account_type === "agency";
  if (!isAgency && !isPlatformAdmin(user.email)) {
    return NextResponse.json(
      { error: "White-label branding is an agency feature. Ask an admin to enable it for your workspace." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: { brand_name?: string | null; brand_color?: string | null; logo_url?: string | null } = {};

  if (typeof body.brandName === "string") data.brand_name = body.brandName.trim().slice(0, 80) || null;
  if (typeof body.brandColor === "string") {
    const c = body.brandColor.trim();
    if (c && !HEX.test(c)) return NextResponse.json({ error: "Brand color must be a hex like #BEF264." }, { status: 400 });
    data.brand_color = c || null;
  }
  if (body.clearLogo === true) {
    data.logo_url = null;
  } else if (typeof body.logoUrl === "string" && body.logoUrl) {
    const logo = body.logoUrl.trim();
    if (!DATA_IMG.test(logo)) {
      return NextResponse.json({ error: "Upload a PNG, JPG, SVG or WebP image." }, { status: 400 });
    }
    if (logo.length > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "That logo is too large (max ~300KB). Try a smaller image." }, { status: 413 });
    }
    data.logo_url = logo;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.organizations.update({ where: { id: org.id }, data });
  return NextResponse.json({
    ok: true,
    branding: { brandName: updated.brand_name, brandColor: updated.brand_color, logoUrl: updated.logo_url },
  });
});
