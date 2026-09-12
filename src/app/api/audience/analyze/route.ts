import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { analyzeCsv } from "@/lib/audience/rfm";

export const runtime = "nodejs";

/**
 * POST /api/audience/analyze — the Customer Analytics & Audience agent.
 *
 * Authenticated + org-scoped. Takes a customer-export CSV and returns RFM
 * quintile segmentation + churn scoring. Pure computation (no DB writes, no
 * credits) — the analysis runs in-process and the result is not persisted, so
 * nothing leaves the tenant's session.
 *
 * Body: { csv }.  Returns: { summary, customers }.
 */
const MAX_BYTES = 2_000_000; // ~2MB of CSV
const MAX_ROWS = 20_000;

export const POST = withErrors<unknown>(async (request) => {
  await getContext(); // require an authenticated org context

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) {
    return NextResponse.json({ error: "Paste or upload a customer CSV first." }, { status: 400 });
  }
  if (csv.length > MAX_BYTES) {
    return NextResponse.json({ error: "That file is too large (max ~2MB). Trim it and try again." }, { status: 413 });
  }

  const result = analyzeCsv(csv);
  if (result.summary.total === 0) {
    return NextResponse.json(
      { error: result.summary.warnings[0] || "We couldn't read any customers from that CSV." },
      { status: 400 },
    );
  }
  if (result.summary.total > MAX_ROWS) {
    return NextResponse.json(
      { error: `That's ${result.summary.total} rows — please keep it under ${MAX_ROWS}.` },
      { status: 413 },
    );
  }

  return NextResponse.json(result);
});
