/**
 * Review-request flow (Module 1). A business asks a customer to leave a Google
 * review via a tracked link. Email-only for now (Resend); `channel` on the model
 * leaves room for WhatsApp after DLT/BSP (SN83). Click tracking: the link points
 * at /r/<token>, which marks the request clicked and redirects to the Google
 * listing.
 */
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";

/** Public base URL for tracked links. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://skirrnow.com").replace(/\/+$/, "");
}

/** The tracked review link for a request token. */
export function reviewLink(token: string): string {
  return `${appUrl()}/r/${token}`;
}

function reviewEmailHtml(opts: { businessName: string; contactName?: string | null; link: string }): string {
  const hi = opts.contactName ? `Hi ${escapeHtml(opts.contactName)},` : "Hi there,";
  const biz = escapeHtml(opts.businessName);
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <p style="font-size:15px">${hi}</p>
    <p style="font-size:15px">Thanks for choosing <strong>${biz}</strong>! If we did a good job, a quick review would mean a lot and helps other people find us.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.link}" style="background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;display:inline-block;font-size:15px">Leave a review</a>
    </p>
    <p style="font-size:13px;color:#6b7280">Or paste this link into your browser: ${opts.link}</p>
    <p style="font-size:13px;color:#6b7280">Thank you! — ${biz}</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/**
 * Send one queued review request via Resend and record the outcome. Best-effort:
 * updates status to `sent` (with sent_at) or `error` (with the message); never
 * throws to the caller.
 */
export async function sendReviewRequest(id: string): Promise<void> {
  const rr = await prisma.review_requests.findUnique({ where: { id } }).catch(() => null);
  if (!rr || rr.channel !== "email" || !rr.contact_email) return;

  // Business name comes from the kit on the same project (fallback: generic).
  const kit = await prisma.presence_kits
    .findFirst({ where: { project_id: rr.project_id }, orderBy: { created_at: "desc" }, select: { business_name: true } })
    .catch(() => null);
  const businessName = kit?.business_name || "our team";

  try {
    await sendEmail({
      to: rr.contact_email,
      subject: `How was your experience with ${businessName}?`,
      html: reviewEmailHtml({ businessName, contactName: rr.contact_name, link: reviewLink(rr.token) }),
    });
    await prisma.review_requests.update({
      where: { id },
      data: { status: "sent", sent_at: new Date(), updated_at: new Date() },
    });
  } catch (e) {
    await prisma.review_requests.update({
      where: { id },
      data: { status: "error", error: e instanceof Error ? e.message.slice(0, 500) : "send failed", updated_at: new Date() },
    }).catch(() => {});
  }
}
