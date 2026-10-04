/**
 * WhatsApp Cloud API sender (Meta). Plain fetch on the Node runtime — mirrors
 * the Resend client's shape. Sends template or free-form text messages through
 * the Graph API.
 *
 * Config via env (set on the host / .env.local, never committed):
 *   WHATSAPP_PHONE_NUMBER_ID   - the sending number's id (test or production)
 *   WHATSAPP_TEMP_TOKEN        - 24h test token (dev), OR
 *   WHATSAPP_PERMANENT_TOKEN   - long-lived System User token (production)
 *   WHATSAPP_API_VERSION       - Graph API version (default v22.0)
 *   WHATSAPP_REVIEW_TEMPLATE   - approved review-request template name
 *                                (falls back to hello_world until one exists)
 *
 * Outside a 24h customer-initiated window WhatsApp permits only TEMPLATE
 * messages, so review requests send a template. Free-form text is valid only
 * inside an open conversation window.
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION?.trim() || "v22.0";

function token(): string | undefined {
  return process.env.WHATSAPP_PERMANENT_TOKEN?.trim() || process.env.WHATSAPP_TEMP_TOKEN?.trim() || undefined;
}

function phoneNumberId(): string | undefined {
  return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || undefined;
}

/** The configured review-request template name (approved template, or the universal hello_world). */
export function reviewTemplateName(): string {
  return process.env.WHATSAPP_REVIEW_TEMPLATE?.trim() || "hello_world";
}

/** True when a token and a sending number are both configured. */
export function isWhatsAppConfigured(): boolean {
  return !!token() && !!phoneNumberId();
}

/** Normalize to digits only (Graph wants E.164 without +, spaces or dashes). */
export function normalizePhone(to: string): string {
  return (to || "").replace(/[^\d]/g, "");
}

interface GraphResponse {
  messages?: { id: string }[];
  error?: { message?: string; code?: number };
}

async function postMessage(payload: Record<string, unknown>): Promise<{ id: string }> {
  const t = token();
  const pid = phoneNumberId();
  if (!t || !pid) {
    throw new Error("WhatsApp is not configured (missing token or phone number id).");
  }

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${pid}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
  });

  const body = (await res.json().catch(() => ({}))) as GraphResponse;
  if (!res.ok) {
    throw new Error((body.error?.message || `WhatsApp send failed (${res.status}).`).slice(0, 300));
  }
  const id = body.messages?.[0]?.id;
  if (!id) {
    throw new Error("WhatsApp did not return a message id.");
  }
  return { id };
}

export interface TemplateComponent {
  type: string;
  sub_type?: string;
  index?: string;
  parameters?: { type: string; text?: string }[];
}

/** Send a pre-approved template message. Required outside the 24h session window. */
export async function sendWhatsAppTemplate(opts: {
  to: string;
  template: string;
  languageCode?: string;
  components?: TemplateComponent[];
}): Promise<{ id: string }> {
  return postMessage({
    to: normalizePhone(opts.to),
    type: "template",
    template: {
      name: opts.template,
      language: { code: opts.languageCode || "en_US" },
      ...(opts.components && opts.components.length ? { components: opts.components } : {}),
    },
  });
}

/** Send a free-form text message. Valid only inside an open 24h customer window. */
export async function sendWhatsAppText(opts: { to: string; body: string }): Promise<{ id: string }> {
  return postMessage({
    to: normalizePhone(opts.to),
    type: "text",
    text: { preview_url: false, body: opts.body },
  });
}
