/**
 * Resend email client. Sends transactional + campaign email via the Resend REST
 * API (no SDK dependency — a plain fetch, which runs fine on the Node host).
 *
 * Requires RESEND_API_KEY. The default From address falls back to Resend's
 * shared test sender (onboarding@resend.dev), which ONLY delivers to the Resend
 * account owner until you verify a sending domain and set MAIL_FROM to an
 * address on it (e.g. launch@skirrnow.app). Webhooks land at /api/webhooks/resend.
 */

export interface SendEmailParams {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
}

/** Default sender: MAIL_FROM if set, else Resend's test sender. */
export function defaultFrom(): string {
  return process.env.MAIL_FROM?.trim() || "SkirrNow <onboarding@resend.dev>";
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
