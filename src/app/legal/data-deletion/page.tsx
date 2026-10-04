import { LegalDoc, type Block } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Data Deletion · SkirrNow" };

const blocks: Block[] = [
  {
    h: "1. Your right to delete your data",
    p: [
      `${LEGAL.brand} is operated by ${LEGAL.entity}. You can ask us to delete the personal data we hold about you at any time. This page explains how, in line with our Privacy Policy.`,
    ],
  },
  {
    h: "2. Delete your account yourself",
    p: [
      "If you have a SkirrNow account, the fastest way is to delete it from inside the app: sign in, open Account settings, and choose Delete account. This permanently removes your account, anonymises your email, and deletes your sign-in identity with our authentication provider (Clerk).",
    ],
  },
  {
    h: "3. Request deletion by email",
    p: [
      `If you cannot sign in, or you connected a service (such as a WhatsApp Business account) through SkirrNow and want that data removed, email ${LEGAL.contactEmail} from the address on your account. Tell us your workspace name and what you want deleted.`,
      "We will verify the request and delete the associated personal data, and instruct our processors to do the same, within 30 days. Some records may be retained where the law requires it (for example, tax and transaction records), after which they are deleted.",
    ],
  },
  {
    h: "4. Data connected through Meta / WhatsApp",
    p: [
      "Where a business connects its WhatsApp Business account to SkirrNow, we access only the data that business grants us to provide the messaging features it configures. On a deletion request, we remove the connection and the message and contact data we hold for that business, and revoke the associated access tokens.",
    ],
  },
  {
    h: "5. Contact",
    p: [`${LEGAL.entity}, ${LEGAL.address}. Email ${LEGAL.contactEmail}.`],
  },
];

export default function DataDeletionPage() {
  return (
    <LegalDoc
      title="Data Deletion"
      intro="How to delete your SkirrNow account and request removal of the personal data we hold about you."
      blocks={blocks}
    />
  );
}
