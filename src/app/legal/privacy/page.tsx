import { LegalDoc, type Block } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Privacy Policy · SkirrNow" };

const blocks: Block[] = [
  {
    h: "1. Who we are",
    p: [
      `${LEGAL.brand} (“${LEGAL.shortBrand}”, “we”, “us”) is operated by ${LEGAL.entity} (${LEGAL.cin}), with its registered office at ${LEGAL.address}. This Privacy Policy explains what personal data we collect when you use our website and application (the “Service”), why we collect it, and the choices you have. For any privacy request, contact us at ${LEGAL.contactEmail}.`,
    ],
  },
  {
    h: "2. Data we collect",
    ul: [
      "Account data: your name, email address, and authentication identifiers, handled through our authentication provider (Clerk).",
      "Workspace data: the workspaces (organisations) you create or join, your role, and workspace settings.",
      "Content you provide: briefs, product and campaign details, prompts, brand information, uploaded assets, and lead information you enter to generate marketing outputs.",
      "Generated outputs: the ad copy, images, videos, and landing pages the Service produces for you.",
      "Usage & telemetry: generation events, credit and AI-token consumption, timestamps, feature usage, and diagnostic logs, used to meter your plan and operate the Service.",
      "Payment data: when paid billing is enabled, payments are processed by our payment gateway (e.g. Razorpay). We do not store full card details; we receive limited transaction metadata such as status and a reference ID.",
      "Technical data: IP address, browser/device information, and cookies necessary to keep you signed in and secure the Service.",
    ],
  },
  {
    h: "3. How we use your data",
    ul: [
      "To provide, operate, and secure the Service and your account.",
      "To generate the marketing outputs you request.",
      "To meter and enforce plan credits and AI-token allowances, and to prevent abuse or overspend.",
      "To provide support, respond to your requests, and send service-related communications.",
      "To improve reliability and performance, and to comply with legal obligations.",
    ],
    p: [
      "We do not sell your personal data. We do not use the private content of your workspace to train our own or third parties' models.",
    ],
  },
  {
    h: "4. AI processing and sub-processors",
    p: [
      "To deliver the Service we share the minimum necessary content with trusted sub-processors that perform specific functions on our behalf:",
    ],
    ul: [
      "Anthropic (Claude) — generates and reviews text such as ad copy and landing-page HTML from the briefs you provide.",
      "Higgsfield — generates and renders graphics, video, and related media.",
      "Clerk — authentication and account management.",
      "Neon — hosted PostgreSQL database where your workspace data is stored.",
      "Hostinger — application hosting and delivery.",
      "Razorpay (when billing is enabled) — payment processing.",
    ],
    // second block below continues
  },
  {
    p: [
      "Each sub-processor is bound to use the data only to provide its service to us. Some of these providers may process data outside India; where that happens we rely on appropriate safeguards.",
    ],
  },
  {
    h: "5. Data retention",
    p: [
      "We retain workspace and account data for as long as your account is active, and for a reasonable period afterwards to meet legal, accounting, and dispute-resolution needs. You can ask us to delete your account data as described below; some records (for example transaction records) may be retained where the law requires.",
    ],
  },
  {
    h: "6. Security",
    p: [
      "We use industry-standard measures — encrypted transport (HTTPS), access controls, and reputable infrastructure providers — to protect your data. No method of transmission or storage is perfectly secure, but we work to protect your information and to notify you of material incidents where required by law.",
    ],
  },
  {
    h: "7. Your rights",
    ul: [
      "Access — request a copy of the personal data we hold about you.",
      "Correction — ask us to correct inaccurate data.",
      "Deletion — ask us to delete your account and associated personal data, subject to legal retention limits.",
      "Portability — request an export of the content you have provided.",
      "Objection / withdrawal of consent — where processing relies on your consent.",
    ],
    p: [`To exercise any of these rights, email ${LEGAL.contactEmail}. We will respond within a reasonable time.`],
  },
  {
    h: "8. Cookies",
    p: [
      "We use only the cookies necessary to keep you signed in, secure the Service, and remember basic preferences. We do not use advertising cookies. You can control cookies through your browser settings, though disabling essential cookies may prevent you from signing in.",
    ],
  },
  {
    h: "9. Children",
    p: [
      "The Service is intended for businesses and users aged 18 or over. It is not directed at children, and we do not knowingly collect data from anyone under 18.",
    ],
  },
  {
    h: "10. Changes to this policy",
    p: [
      "We may update this policy from time to time. When we make material changes, we will update the “Last updated” date above and, where appropriate, notify you. Continued use of the Service after an update means you accept the revised policy.",
    ],
  },
  {
    h: "11. Contact",
    p: [`Questions or requests: ${LEGAL.entity}, ${LEGAL.address}. Email ${LEGAL.contactEmail}.`],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro="This policy describes how SkirrNow handles the personal data of the people and businesses who use the Service."
      blocks={blocks}
    />
  );
}
