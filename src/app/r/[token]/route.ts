import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const SAFE_FALLBACK = "https://skirrnow.com";

/** A valid absolute http(s) base URL, or the hard fallback. */
function homeUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || SAFE_FALLBACK).trim();
  return /^https?:\/\//i.test(base) ? base.replace(/\/+$/, "") : SAFE_FALLBACK;
}

/**
 * GET /r/[token] — tracked review link. Marks the review request `clicked`
 * (best-effort) and redirects the customer to the business's Google listing.
 * PUBLIC (see middleware). No auth; the token is the capability. This endpoint
 * must NEVER error for a visitor — any failure falls through to a safe redirect.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const home = homeUrl();
  let dest = home;
  try {
    const token = (params?.token || "").slice(0, 100);
    if (token) {
      const rr = await prisma.review_requests.findUnique({
        where: { token },
        select: { id: true, google_place_url: true, status: true },
      });
      if (rr) {
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
        if (rr.google_place_url && /^https?:\/\//i.test(rr.google_place_url)) {
          dest = rr.google_place_url;
        }
      }
    }
  } catch {
    /* never surface an error to a customer clicking a review link */
  }
  return NextResponse.redirect(dest, { status: 302 });
}
