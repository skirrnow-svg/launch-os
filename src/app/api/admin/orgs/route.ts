import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { claudeTokensForAccountType } from "@/lib/billing/plans";

export const runtime = "nodejs";

/**
 * Admin-only organization management.
 * GET   → list every org with its account type + credit budget + usage.
 * PATCH → set an org's account_type ('solo'|'sme'|'agency') and/or credit_cap.
 *
 * This is a platform-admin capability (requireAdmin throws FORBIDDEN otherwise)
 * that ordinary tenants never have — e.g. promoting an org to 'agency' unlocks
 * its white-label branding.
 */
const ACCOUNT_TYPES = ["solo", "sme", "agency"];

function forbidden(e: unknown) {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  throw e;
}

export const GET = withErrors<unknown>(async () => {
  try {
    await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const orgs = await prisma.organizations.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: "asc" },
    select: {
      id: true, name: true, slug: true, account_type: true,
      credit_cap: true, credits_used: true, claude_token_cap: true, claude_tokens_used: true,
      brand_name: true, logo_url: true,
    },
  });
  return NextResponse.json({
    orgs: orgs.map((o) => ({
      id: o.id, name: o.name, slug: o.slug, accountType: o.account_type,
      creditCap: o.credit_cap, creditsUsed: Number(o.credits_used ?? 0),
      claudeTokenCap: o.claude_token_cap == null ? null : Number(o.claude_token_cap),
      claudeTokensUsed: Number(o.claude_tokens_used ?? 0),
      claudeTokenDefault: claudeTokensForAccountType(o.account_type),
      branded: !!(o.brand_name || o.logo_url),
    })),
  });
});

export const PATCH = withErrors<unknown>(async (request) => {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  if (!orgId) return NextResponse.json({ error: "orgId is required." }, { status: 400 });

  const data: { account_type?: string; credit_cap?: number | null; claude_token_cap?: bigint | null } = {};
  if (typeof body.accountType === "string") {
    if (!ACCOUNT_TYPES.includes(body.accountType)) {
      return NextResponse.json({ error: `accountType must be one of ${ACCOUNT_TYPES.join(", ")}.` }, { status: 400 });
    }
    data.account_type = body.accountType;
  }
  if ("creditCap" in body) {
    const v = body.creditCap;
    if (v === null || v === "") data.credit_cap = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "creditCap must be a non-negative number or null." }, { status: 400 });
      data.credit_cap = Math.round(n);
    }
  }
  if ("claudeTokenCap" in body) {
    const v = body.claudeTokenCap;
    if (v === null || v === "") data.claude_token_cap = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "claudeTokenCap must be a non-negative number or null." }, { status: 400 });
      data.claude_token_cap = BigInt(Math.round(n));
    }
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const updated = await prisma.organizations.update({
    where: { id: orgId },
    data,
    select: { id: true, account_type: true, credit_cap: true, claude_token_cap: true },
  });
  await recordAudit({
    orgId: ctx.org.id, userId: ctx.user.id, action: "org.update", resourceType: "organization", resourceId: orgId,
    changes: { accountType: data.account_type, creditCap: data.credit_cap, claudeTokenCap: data.claude_token_cap == null ? data.claude_token_cap : Number(data.claude_token_cap) },
  });
  return NextResponse.json({
    ok: true,
    org: { id: updated.id, accountType: updated.account_type, creditCap: updated.credit_cap, claudeTokenCap: updated.claude_token_cap == null ? null : Number(updated.claude_token_cap) },
  });
});
