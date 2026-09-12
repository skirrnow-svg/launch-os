import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { issueCode } from "@/lib/free/verify";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";

/**
 * POST /api/public/free/code — start the free Product-to-Ad generator.
 *
 * PUBLIC (covered by /api/public in middleware). Emails a 6-digit verification
 * code and returns an opaque signed token (never the code). The visitor proves
 * they control the email before we spend any generation on their behalf.
 *
 * Body: { email }.  Returns: { ok, token, exp }.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort per-process throttle: one code per email per 30s. (A durable
// rate-limit belongs in Redis/DB; this blunts casual abuse on a single host.)
const lastSent = new Map<string, number>();
const THROTTLE_MS = 30_000;

export const POST = withErrors<unknown>(async (request) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const key = email.toLowerCase();
  const prev = lastSent.get(key);
  if (prev && Date.now() - prev < THROTTLE_MS) {
    return NextResponse.json(
      { error: "We just sent a code. Check your inbox, or try again in a moment." },
      { status: 429 },
    );
  }
  lastSent.set(key, Date.now());

  const { code, token, exp } = issueCode(email);

  await sendEmail({
    to: email,
    subject: `${code} is your SkirrNow verification code`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <p style="font-size:14px;color:#555">Your SkirrNow verification code is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
      <p style="font-size:13px;color:#888">It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>`,
  });

  return NextResponse.json({ ok: true, token, exp });
});
