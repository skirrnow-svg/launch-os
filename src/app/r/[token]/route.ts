import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /r/[token] — tracked review link. Marks the review request `clicked`
 * (best-effort) and redirects the customer to the business's Google listing.
 * PUBLIC (see middleware). No auth; the token is the capability.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = (params.token || "").slice(0, 100);
  const fallback = (process.env.NEXT_PUBLIC_APP_URL || "https://skirrnow.com").replace(/\/+$/, "");

  const rr = await prisma.review_requests
    .findUnique({ where: { token }, select: { id: true, google_place_url: true, status: true } })
    .catch(() => null);

  if (!rr) return NextResponse.redirect(fallback, { status: 302 });

  // First click wins the status transition; later clicks just update the time.
  await prisma.review_requests
    .update({
      where: { id: rr.id },
      data: {
        status: rr.status === "reviewed" ? "reviewed" : "clicked",
        clicked_at: new Date(),
        updated_at: new Date(),
      },
    })
    .catch(() => {});

  const dest = rr.google_place_url && /^https?:\/\//i.test(rr.google_place_url) ? rr.google_place_url : fallback;
  return NextResponse.redirect(dest, { status: 302 });
}
