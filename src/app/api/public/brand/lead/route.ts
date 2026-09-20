import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { verifyCode } from "@/lib/free/verify";
import { countFreeUses } from "@/lib/free/entitlement";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/public/brand/lead — unlock a Brand Studio download for a signed-out
 * visitor after email (pin) verification.
 *
 * Ladder: an email-verified visitor gets ONE free branded download; a second
 * needs a free account (the client sends signed-in users straight to the
 * download, so they never hit this route). PUBLIC (covered by /api/public). The
 * 6-digit code is emailed by /api/public/free/code; here we verify it and, if
 * this email hasn't used its free download yet, record the lead and allow it.
 *
 * Body: { email, code, token, media? }.  Returns: { ok } | 403 { needsSignup }.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREE_BRAND_LIMIT = 1;

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

  const orgId = process.env.DEFAULT_LEAD_ORG_ID;
  if (orgId) {
    // One free branded download per email; a second must create an account.
    if ((await countFreeUses(orgId, email, "brand-studio")) >= FREE_BRAND_LIMIT) {
      return NextResponse.json(
        {
          error: "You've used your free branded download. Create a free account for unlimited branding.",
          needsSignup: true,
        },
        { status: 403 },
      );
    }
    // Record the claim (best-effort — never block the free download on storage).
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
