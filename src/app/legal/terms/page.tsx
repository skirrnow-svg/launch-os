import { LegalDoc, type Block } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Terms of Use · SkirrNow" };

const blocks: Block[] = [
  {
    h: "1. Agreement to these terms",
    p: [
      `These Terms of Use (“Terms”) are a binding agreement between you (and the business you represent) and ${LEGAL.entity} (“${LEGAL.shortBrand}”, “we”, “us”), operator of ${LEGAL.brand} (the “Service”). By creating an account or using the Service you agree to these Terms. If you do not agree, do not use the Service.`,
    ],
  },
  {
    h: "2. Eligibility and accounts",
    ul: [
      "You must be at least 18 years old and able to form a binding contract.",
      "You are responsible for the activity under your account and for keeping your credentials secure.",
      "Workspaces (organisations) may have multiple members; the workspace owner is responsible for the members they invite and for the workspace's use of the Service.",
    ],
  },
  {
    h: "3. The Service",
    p: [
      "SkirrNow is an AI-assisted marketing platform. It qualifies inbound leads, helps prepare marketing materials, and generates outputs such as ad copy, images, videos, and landing pages, with a human approval step before outputs are treated as final. We may add, change, or remove features over time.",
    ],
  },
  {
    h: "4. Plans, credits and billing",
    ul: [
      "Paid plans are billed monthly in advance. Each plan includes a monthly allowance of generation credits and AI-token capacity, which reset with your billing cycle and do not carry over.",
      "Media generation draws from your workspace's monthly credit pool. If a job would exceed your remaining credits, it is held rather than completed, so you are not charged for overspend.",
      "Prices are shown on our pricing page and may change; changes apply to future billing periods. Applicable taxes (such as GST) may be added.",
      "When paid billing is enabled, payments are processed by our payment gateway; your use of it is also subject to its terms.",
    ],
  },
  {
    h: "5. Your content and ownership",
    ul: [
      "You retain ownership of the briefs, brand materials, and other content you submit (“Your Content”). You grant us a limited licence to process Your Content solely to operate the Service and generate your outputs.",
      "Subject to your compliance with these Terms and payment of applicable fees, the outputs the Service generates for you are yours to use for your business.",
      "You are responsible for ensuring you have the rights to the content you submit, and that your use of the outputs complies with applicable law and any third-party rights.",
    ],
  },
  {
    h: "6. AI-generated content — important",
    p: [
      "Outputs are produced by automated AI systems and may contain errors, inaccuracies, or claims that require verification. Outputs are drafts to assist you — not professional, legal, financial, medical, or regulatory advice, and not a guarantee of any commercial result.",
      "Before publishing or relying on any output, you must review it, verify factual and promotional claims, and ensure it complies with applicable advertising and consumer-protection laws. The human approval gate exists for this purpose; approving and publishing an output is your decision and responsibility.",
    ],
  },
  {
    h: "7. Acceptable use",
    p: [
      "Your use of the Service is subject to our Acceptable Use & Disclaimer policy, which is incorporated into these Terms. Prohibited uses include unlawful, deceptive, infringing, or harmful activity. We may suspend or terminate accounts that violate it.",
    ],
  },
  {
    h: "8. Third-party services",
    p: [
      "The Service relies on third-party providers (for example authentication, AI generation, hosting, and payments). We are not responsible for the acts or omissions of those providers, and their availability may affect the Service.",
    ],
  },
  {
    h: "9. Suspension and termination",
    ul: [
      "You may stop using the Service and cancel at any time, as described in our Refund & Cancellation policy.",
      "We may suspend or terminate access if you breach these Terms, fail to pay, or use the Service in a way that risks harm to others, the Service, or us.",
      "On termination, your right to use the Service ends; provisions that by their nature should survive (such as ownership, disclaimers, and liability limits) will survive.",
    ],
  },
  {
    h: "10. Disclaimers",
    p: [
      'The Service and all outputs are provided "as is" and "as available", without warranties of any kind, whether express or implied, including fitness for a particular purpose, accuracy, or non-infringement, to the maximum extent permitted by law.',
    ],
  },
  {
    h: "11. Limitation of liability",
    p: [
      "To the maximum extent permitted by law, we will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our total liability for any claim relating to the Service is limited to the amount you paid us for the Service in the three (3) months before the event giving rise to the claim.",
    ],
  },
  {
    h: "12. Indemnity",
    p: [
      "You agree to indemnify and hold us harmless from claims, damages, and costs arising out of your content, your use of the outputs, or your breach of these Terms or applicable law.",
    ],
  },
  {
    h: "13. Changes to these terms",
    p: [
      'We may update these Terms from time to time. Material changes will be reflected by the "Last updated" date above and, where appropriate, notified to you. Continued use after an update means you accept the revised Terms.',
    ],
  },
  {
    h: "14. Governing law and jurisdiction",
    p: [
      `These Terms are governed by the laws of ${LEGAL.governingLaw}. The courts at ${LEGAL.governingCity} shall have exclusive jurisdiction over any dispute arising out of or relating to these Terms or the Service.`,
    ],
  },
  {
    h: "15. Contact",
    p: [`${LEGAL.entity}, ${LEGAL.address}. Email ${LEGAL.contactEmail}.`],
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Use"
      intro="These terms govern your use of SkirrNow. Please read them carefully — using the Service means you accept them."
      blocks={blocks}
    />
  );
}
