import { NextResponse } from "next/server";
import { getContext, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrgBudget } from "@/lib/credits";
import { getEntitlement } from "@/lib/billing/entitlements";
import { resolveBuilderAccess } from "@/lib/billing/builderGate";


/**
 * Current organization API.
 * GET   → the active org (id, name, slug).
 * PATCH → rename the active org (used by the onboarding wizard). Only the name
 *         is editable; the slug/clerk mapping are immutable identity.
 */

export async function GET() {
  const { user, org } = await getContext();
  const isAdmin = isPlatformAdmin(user.email);
  const [projectCount, budget, ent, builder] = await Promise.all([
    prisma.projects.count({ where: { org_id: org.id, deleted_at: null } }),
    getOrgBudget(org.id),
    getEntitlement(org),
    resolveBuilderAccess(org, isAdmin),
  ]);
  return NextResponse.json({
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      accountType: org.account_type,
      brandName: org.brand_name,
      brandColor: org.brand_color,
      logoUrl: org.logo_url,
    },
    isAdmin,
    // Paid = an active/trialing plan; admins are treated as paid for testing.
    plan: {
      slug: ent.planSlug,
      name: ent.planName,
      status: ent.status,
      isPaid: ent.planSlug != null || isAdmin,
      // AI Video Prompt Builder access: "none" | "basic" | "advanced", plus the
      // (admin-editable) credit thresholds so the UI can explain what unlocks what.
      builder: {
        level: builder.level,
        basicMin: builder.basicMin,
        advancedMin: builder.advancedMin,
      },
    },
    projectCount,
    budget,
  });
}

export async function PATCH(request: Request) {
  const { org } = await getContext();
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "A workspace name is required." }, { status: 400 });
  }
  const updated = await prisma.organizations.update({
    where: { id: org.id },
    data: { name: name.slice(0, 120) },
  });
  return NextResponse.json({ org: { id: updated.id, name: updated.name, slug: updated.slug } });
}
