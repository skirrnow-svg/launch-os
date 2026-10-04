import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * WhatsApp Cloud API webhook. PUBLIC (see middleware `/api/webhooks(.*)`).
 * Meta calls this unauthenticated, so the GET verify handshake and a fast 200
 * on POST are the contract — this endpoint must never hang or 500, or Meta
 * disables the subscription and retry-storms.
 *
 * GET  — subscription verification: echo hub.challenge when the token matches
 *        WHATSAPP_VERIFY_TOKEN (the value you set in the Meta webhook config).
 * POST — inbound messages + message-status events. Acknowledged with 200;
 *        best-effort parse only.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as WhatsAppWebhookBody | null;
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    // Inbound customer messages and delivery/read/failed statuses arrive here.
    // TODO(SN84+): map value.statuses[].id (wamid) back to a review_requests row
    // to sync delivered/read/failed — requires storing the wamid on send first.
    if (value?.statuses?.length) {
      // no-op for now; statuses acknowledged
    }
  } catch {
    // never surface an error to Meta — always acknowledge
  }
  return NextResponse.json({ received: true }, { status: 200 });
}

interface WhatsAppWebhookBody {
  entry?: {
    changes?: {
      value?: {
        messages?: unknown[];
        statuses?: { id?: string; status?: string }[];
      };
    }[];
  }[];
}
