import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/visitors?days=14 — daily free-funnel counts for the admin.
 *
 *   anonymous — distinct browser ids that hit a free tool that day (visits)
 *   verified  — distinct emails that passed email-pin verification that day (leads)
 *   signedUp  — accounts created that day (users)
 *
 * A visitor funnel, not a strict cohort: the three stages are counted
 * independently per day. Admin-only.
 */
type Row = { d: string; c: number };

export const GET = withErrors<unknown>(async (request) => {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }
    throw e;
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const since = `now() - interval '${days} days'`;

  const [anon, verified, signed] = (await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') d, count(distinct anon_id)::int c
       FROM visits WHERE created_at >= ${since} GROUP BY 1`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') d, count(distinct lower(email))::int c
       FROM leads WHERE created_at >= ${since} GROUP BY 1`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') d, count(*)::int c
       FROM users WHERE created_at >= ${since} GROUP BY 1`,
    ),
  ])) as [Row[], Row[], Row[]];

  const map = (rows: Row[]) => Object.fromEntries(rows.map((r) => [r.d, Number(r.c)]));
  const a = map(anon), v = map(verified), s = map(signed);

  // Build a continuous day series (newest first), zero-filled.
  const series: { day: string; anonymous: number; verified: number; signedUp: number }[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    series.push({ day: key, anonymous: a[key] || 0, verified: v[key] || 0, signedUp: s[key] || 0 });
  }

  const totals = series.reduce(
    (t, r) => ({ anonymous: t.anonymous + r.anonymous, verified: t.verified + r.verified, signedUp: t.signedUp + r.signedUp }),
    { anonymous: 0, verified: 0, signedUp: 0 },
  );

  return NextResponse.json({ days, series, totals });
});
