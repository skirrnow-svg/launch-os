import { NextResponse } from "next/server";
import { ingestLead } from "@/lib/leads";
import { withErrors } from "@/lib/api";

export const runtime = "edge";

/**
 * POST /api/public/get-started — the marketing site's lead form.
 *
 * PUBLIC route (see middleware). Unlike the raw webhook, the org is NOT taken
 * from the client — it's the server-configured DEFAULT_LEAD_ORG_ID (SkirrNow's
 * own agency org), so a browser can't target another tenant. A form submission
 * is treated as positive intent and wakes the qualification runner.
 *
 * Body: { name, email, company, metro?, phone?, message? }.
 */
export const POST = withErrors<unknown>(async (request) => {
  const orgId = process.env.DEFAULT_LEAD_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "Lead capture is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const name = s("name");
  const email = s("email");
  const company = s("company");
  const metro = s("metro");
  const phone = s("phone");
  const message = s("message");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!company && !name) {
    return NextResponse.json({ error: "Please tell us your name or company." }, { status: 400 });
  }

  const lines = [
    name && `Name: ${name}`,
    company && `Company: ${company}`,
    metro && `Metro area: ${metro}`,
    phone && `Phone: ${phone}`,
    message && `\n${message}`,
  ].filter(Boolean);

  const result = await ingestLead({
    orgId,
    email,
    subject: `New inquiry from ${company || name || email}`,
    body: lines.join("\n") || "New inquiry via the website.",
    forceInterested: true,
  });

  return NextResponse.json({ ok: true, lead_id: result.lead_id });
});
