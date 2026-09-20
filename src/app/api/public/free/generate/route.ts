import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { verifyCode } from "@/lib/free/verify";
import { scrapeSite } from "@/lib/free/scrape";
import { hasClaimedFree } from "@/lib/free/entitlement";
import { ingestLead } from "@/lib/leads";

export const runtime = "nodejs";

/**
 * POST /api/public/free/generate — verify the email code, scrape the site, and
 * enqueue a free-generator lead. The runner then writes 3 viral hooks + an AI
 * marketing audit onto the lead (text only, 0 credits). The animated teaser is
 * NOT rendered here — it stays behind the phone-verified gate (docs/VISION.md),
 * so the free path never auto-spends Higgsfield credits.
 *
 * Body: { email, code, token, url }.  Returns: { ok, lead_id }.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withErrors<unknown>(async (request) => {
  const orgId = process.env.DEFAULT_LEAD_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "The free generator isn't configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const email = s("email");
  const code = s("code");
  const token = s("token");
  const url = s("url");

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!verifyCode(email, code, token)) {
    return NextResponse.json({ error: "That code is incorrect or has expired." }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: "Enter your website URL." }, { status: 400 });
  }

  // One free audit per email. A second attempt with the same email must sign up.
  if (await hasClaimedFree(orgId, email, "free-generator")) {
    return NextResponse.json(
      {
        error: "You've already used your free audit. Create a free account to run more.",
        needsAccount: true,
      },
      { status: 403 },
    );
  }

  // SSRF-guarded scrape (throws a friendly message on bad/unreachable URLs).
  const site = await scrapeSite(url).catch((e: unknown) => {
    throw new Error(e instanceof Error ? e.message : "We couldn't read that website.");
  });

  const result = await ingestLead({
    orgId,
    email,
    subject: `Free Product-to-Ad audit: ${site.title}`,
    body: `WEBSITE: ${site.url}\n\n${site.summary}`,
    forceInterested: true,
    source: "free-generator",
    autoVideo: false,
  });

  return NextResponse.json({ ok: true, lead_id: result.lead_id, site: { url: site.url, title: site.title } });
});
