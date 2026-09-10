/**
 * Resend API client (STUB) — transactional + campaign email. Reads
 * RESEND_API_KEY from the env. Email webhooks land at /api/webhooks/resend.
 * TODO(phase-2): implement send() + batch() with the resend SDK.
 */

export interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(_params: SendEmailParams): Promise<{ id: string }> {
  // TODO(phase-2): call Resend and return the message id.
  throw new Error("TODO(phase-2): Resend sendEmail() not implemented");
}
