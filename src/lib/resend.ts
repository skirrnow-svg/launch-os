/**
 * Resend email client. Sends transactional + campaign email via the Resend REST
 * API (no SDK dependency — a plain fetch, which runs fine on the Node host).
 *
 * Requires RESEND_API_KEY. Every app email — verification codes, lead delivery,
 * and any future transactional/campaign mail — flows through here, so Resend is
 * the single global email path. The default From is our verified skirrnow.com
 * domain sender, which delivers to ANY recipient; set MAIL_FROM to override it.
 * (Resend's shared onboarding@resend.dev only delivers to the account owner, so
 * we never fall back to it.) Webhooks land at /api/webhooks/resend.
 */

/** Verified sending domain address — delivers to any recipient. */
const DEFAULT_FROM = "SkirrNow <skirrnow.agent@skirrnow.com>";

export interface SendEmailParams {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
}

/** Default sender: MAIL_FROM if set, else our verified skirrnow.com domain. */
export function defaultFrom(): string {
  return process.env.MAIL_FROM?.trim() || DEFAULT_FROM;
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from?.trim() || defaultFrom(),
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    // Resend returns { name, message } on error (e.g. domain not verified).
    throw new Error(body.message || body.name || `Resend send failed (${res.status}).`);
  }
  if (!body.id) {
    throw new Error("Resend did not return a message id.");
  }
  return { id: body.id };
}
