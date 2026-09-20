import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/public/visit — record one anonymous visit to a free tool, for the
 * admin visitor funnel (top-of-funnel reach). Best-effort: never blocks the page.
 *
 * PUBLIC (covered by /api/public). Body: { anonId, path }. The `anonId` is a
 * browser-generated id (localStorage) so daily *distinct* visitors can be
 * counted without cookies or PII. Verified/signed-up stages are derived from
 * the leads + users tables, not here.
 */
export const POST = withErrors<unknown>(async (request) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const anonId = typeof body.anonId === "string" ? body.anonId.slice(0, 64) : "";
  const path = typeof body.path === "string" ? body.path.slice(0, 128) : "";
  if (!anonId || !path) return NextResponse.json({ ok: true }); // silently ignore junk

  try {
    await prisma.visits.create({ data: { anon_id: anonId, path }, select: { id: true } });
  } catch {
    /* best-effort telemetry — never surface an error to the visitor */
  }
  return NextResponse.json({ ok: true });
});
