import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isWhatsAppConfigured, sendWhatsAppTemplate } from "@/lib/whatsapp";

export const runtime = "nodejs";

/**
 * Admin-only WhatsApp test send. POST { to, template?, languageCode? } fires a
 * template message from the configured (test or production) number, so the
 * operator can confirm the Cloud API wiring end-to-end from the app itself.
 * Defaults to the universal `hello_world` template.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    if (!isWhatsAppConfigured()) {
      return NextResponse.json(
        { ok: false, error: "WhatsApp is not configured (set WHATSAPP_PHONE_NUMBER_ID and a token)." },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { to?: string; template?: string; languageCode?: string };
    const to = body.to?.trim();
    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing 'to' (recipient phone number)." }, { status: 400 });
    }

    const { id } = await sendWhatsAppTemplate({
      to,
      template: body.template?.trim() || "hello_world",
      languageCode: body.languageCode?.trim() || "en_US",
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "send failed" },
      { status: 500 },
    );
  }
}
