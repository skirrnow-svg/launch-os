import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { verifyCode } from "@/lib/free/verify";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/public/brand/lead — unlock a Brand Studio download after email
 * verification, and capture the visitor as a lead.
 *
 * PUBLIC (covered by /api/public in middleware). The 6-digit code is emailed by
 * the shared /api/public/free/code route; here we verify it (stateless signed
 * token) and record a lightweight lead. Phone OTP is added as a second factor
 * once an OTP provider is wired (SN77).
 *
 * Body: { email, code, token, media? }.  Returns: { ok }.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withErrors<unknown>(async (request) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const token = typeof body.token === "string" ? body.token : "";
  const media = body.media === "video" ? "video" : "image";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!verifyCode(email, code, token)) {
    return NextResponse.json({ error: "That code is incorrect or has expired." }, { status: 400 });
  }

  // Brand Studio branding is UNLIMITED and free — no per-email limit, no
  // paywall. We just capture the visitor as a lead (best-effort) the first
  // time they verify; never block the download on our own storage.
  const orgId = process.env.DEFAULT_LEAD_ORG_ID;
  if (orgId) {
    try {
      await prisma.lead.create({
        data: {
          org_id: orgId,
          email: email.toLowerCase(),
          raw_body: `Brand Studio — free ${media} branding download`,
          intent_status: "INTERESTED",
          status: "PENDING",
          source: "brand-studio",
          auto_video: false,
        },
        select: { id: true },
      });
    } catch (e) {
      console.error("[brand/lead] capture failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true });
});
