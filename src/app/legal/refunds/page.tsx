import { LegalDoc, type Block } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Refund & Cancellation · SkirrNow" };

const blocks: Block[] = [
  {
    h: "1. Subscription model",
    p: [
      `${LEGAL.brand} is offered on monthly subscription plans, billed in advance. Each plan gives your workspace a monthly allowance of generation credits and AI-token capacity that resets at the start of each billing cycle.`,
    ],
  },
  {
    h: "2. Cancelling your subscription",
    ul: [
      "You can cancel your subscription at any time from your billing settings, or by emailing us.",
      "When you cancel, your plan remains active until the end of the billing period you have already paid for. You keep access until then.",
      "At the end of that period the subscription stops and no further charges are made. We do not lock you into long-term contracts.",
    ],
  },
  {
    h: "3. Refunds",
    ul: [
      "Subscription fees are charged for the upcoming month of access. We do not provide refunds for partial or unused portions of a billing period once it has begun.",
      "Unused credits and AI tokens have no cash value, do not carry over to the next cycle, and are not refundable.",
      "Downgrading or cancelling does not entitle you to a refund of the current period; the change takes effect from the next billing cycle.",
    ],
  },
  {
    h: "4. Exceptional refunds",
    p: [
      "We deal with genuine issues fairly. We will review a refund request where:",
    ],
    ul: [
      "you were charged in error, or charged more than once for the same period; or",
      "a verified technical fault on our side prevented you from using the Service for a substantial part of the billing period and we were unable to resolve it.",
    ],
    // continues below
  },
  {
    p: [
      "Approved refunds are made to the original payment method. Refund timelines depend on your bank or payment provider, and are typically completed within 5–10 business days after approval.",
    ],
  },
  {
    h: "5. How to request",
    p: [
      `Email ${LEGAL.contactEmail} from the address on your account, with your workspace name and the charge in question. We aim to acknowledge refund and cancellation requests promptly.`,
    ],
  },
  {
    h: "6. Chargebacks",
    p: [
      "If you have a billing concern, please contact us first — we will try to resolve it quickly. Raising a chargeback without contacting us may lead to suspension of the account while the dispute is investigated.",
    ],
  },
  {
    h: "7. Note on billing availability",
    p: [
      "Where paid billing has not yet been enabled, no charges are taken and this policy applies from the moment paid subscriptions go live. Payments, when enabled, are handled by our payment gateway, whose processing timelines also apply.",
    ],
  },
  {
    h: "8. Contact",
    p: [`${LEGAL.entity}, ${LEGAL.address}. Email ${LEGAL.contactEmail}.`],
  },
];

export default function RefundsPage() {
  return (
    <LegalDoc
      title="Refund & Cancellation Policy"
      intro="How cancellations and refunds work for SkirrNow's monthly subscription plans."
      blocks={blocks}
    />
  );
}
