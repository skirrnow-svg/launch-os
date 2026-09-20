import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { withErrors } from "@/lib/api";
import { scrapeSite } from "@/lib/free/scrape";
import { countFreeUses, FREE_AD_LIMIT } from "@/lib/free/entitlement";
import { ingestLead } from "@/lib/leads";

export const runtime = "nodejs";

/**
 * POST /api/public/free/generate — signed-in visitors only. Scrapes the site
 * and enqueues a free-generator lead; the runner writes 3 viral hooks + an AI
 * marketing audit onto the lead (text only, 0 credits). The animated teaser is
 * NOT rendered here — it stays behind the paid gate — so the free path never
 * auto-spends Higgsfield credits.
 *
 * A free account (no credit card) is the gate: the visitor must be signed in,
 * and each account gets FREE_AD_LIMIT free ads before the payment wall. Identity
 * is the Clerk user's email, so the limit can't be gamed by changing a form
 * field. Body: { url }.  Returns: { ok, lead_id }.
 */
export const POST = withErrors<unknown>(async (request) => {
  const orgId = process.env.DEFAULT_LEAD_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "The free generator isn't configured." }, { status: 500 });
  }

  // Gate: must have a free account (signed in). No credit card required.
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Create a free account to generate your ad.", needsSignup: true },
      { status: 401 },
    );
  }
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "";
  if (!email) {
    return NextResponse.json({ error: "Your account has no email on file." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Enter your website URL." }, { status: 400 });
  }

  // Up to FREE_AD_LIMIT free ads per account, then a payment wall.
  if ((await countFreeUses(orgId, email, "free-generator")) >= FREE_AD_LIMIT) {
    return NextResponse.json(
      {
        error: `You've used your ${FREE_AD_LIMIT} free ads. Upgrade to a paid plan to generate more.`,
        needsPayment: true,
      },
      { status: 402 },
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
