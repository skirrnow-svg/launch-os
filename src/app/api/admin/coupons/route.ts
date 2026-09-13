import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { BILLING_TIERS } from "@/lib/billing/plans";
import { COUPON_KINDS, normalizeCode, type CouponKind } from "@/lib/billing/coupons";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Admin-only coupon management.
 * GET    → list every coupon (newest first).
 * POST   → create { code, kind, value, appliesTo?, maxRedemptions?, expiresAt? }.
 * PATCH  → { id, active } toggle a coupon on/off.
 * DELETE → { id } remove a coupon.
 *
 * Redemption + payment capture are wired later (SN25); this endpoint is CRUD.
 */
const SLUGS = BILLING_TIERS.map((t) => t.slug) as string[];

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
  const rows = await prisma.coupons.findMany({ orderBy: { created_at: "desc" } });
  return NextResponse.json({
    coupons: rows.map((c) => ({
      id: c.id, code: c.code, kind: c.kind, value: c.value, appliesTo: c.applies_to,
      maxRedemptions: c.max_redemptions, redeemedCount: c.redeemed_count,
      expiresAt: c.expires_at ? c.expires_at.toISOString() : null,
      active: c.active, createdAt: c.created_at.toISOString(),
    })),
  });
});

export const POST = withErrors<unknown>(async (request) => {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = normalizeCode(typeof body.code === "string" ? body.code : "");
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 3–32 chars: A–Z, 0–9, - or _." }, { status: 400 });
  }
  const kind = (typeof body.kind === "string" ? body.kind : "percent") as CouponKind;
  if (!COUPON_KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of ${COUPON_KINDS.join(", ")}.` }, { status: 400 });
  }
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "value must be a positive number." }, { status: 400 });
  if (kind === "percent" && value > 100) return NextResponse.json({ error: "A percent discount can't exceed 100." }, { status: 400 });

  // applies_to: 'all' or a comma list of known slugs.
  let appliesTo = "all";
  if (Array.isArray(body.appliesTo) && body.appliesTo.length) {
    const slugs = (body.appliesTo as unknown[]).map(String).filter((s) => SLUGS.includes(s));
    if (!slugs.length) return NextResponse.json({ error: "appliesTo must include at least one valid plan." }, { status: 400 });
    appliesTo = slugs.length === SLUGS.length ? "all" : slugs.join(",");
  }

  let expiresAt: Date | null = null;
  if (typeof body.expiresAt === "string" && body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "expiresAt is not a valid date." }, { status: 400 });
    expiresAt = d;
  }
  let maxRedemptions: number | null = null;
  if (body.maxRedemptions !== undefined && body.maxRedemptions !== null && body.maxRedemptions !== "") {
    const n = Number(body.maxRedemptions);
    if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: "maxRedemptions must be a positive whole number." }, { status: 400 });
    maxRedemptions = Math.round(n);
  }

  const existing = await prisma.coupons.findUnique({ where: { code } });
  if (existing) return NextResponse.json({ error: `Coupon "${code}" already exists.` }, { status: 409 });

  const c = await prisma.coupons.create({
    data: { code, kind, value: Math.round(value), applies_to: appliesTo, max_redemptions: maxRedemptions, expires_at: expiresAt },
  });
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: "coupon.create", resourceType: "coupon", changes: { code, kind, value: Math.round(value), appliesTo, maxRedemptions, expiresAt: expiresAt?.toISOString() ?? null } });
  return NextResponse.json({ ok: true, id: c.id });
});

export const PATCH = withErrors<unknown>(async (request) => {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "active (boolean) is required." }, { status: 400 });
  const updated = await prisma.coupons.update({ where: { id }, data: { active: body.active } });
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: body.active ? "coupon.activate" : "coupon.deactivate", resourceType: "coupon", changes: { code: updated.code, active: body.active } });
  return NextResponse.json({ ok: true });
});

export const DELETE = withErrors<unknown>(async (request) => {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const removed = await prisma.coupons.delete({ where: { id } });
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: "coupon.delete", resourceType: "coupon", changes: { code: removed.code } });
  return NextResponse.json({ ok: true });
});
