import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import ContactForm from "@/components/site/ContactForm";
import { LEGAL, LEGAL_PLACEHOLDERS_PRESENT } from "@/lib/legal";

export const metadata = {
  title: "Contact us · SkirrNow",
  description: "Get in touch with the SkirrNow team — support, sales, billing, privacy, and abuse reports.",
};

const CHANNELS = [
  { k: "Product support", d: "Trouble with a generation, your account, or a workspace." },
  { k: "Sales & plans", d: "Questions about plans, credits, or which tier fits you." },
  { k: "Billing & refunds", d: "Charges, invoices, cancellations, and refund requests." },
  { k: "Privacy & data", d: "Access, correction, or deletion of your data (see our Privacy Policy)." },
  { k: "Report abuse", d: "Misuse of the platform or generated content (see Acceptable Use)." },
];

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-slate-900">
            <span className="grid h-6 w-6 place-items-center rounded bg-accent text-xs font-black text-white">S</span>
            SkirrNow
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">&larr; Back to site</Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Contact</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Get in touch
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Questions about the product, your plan, billing, or your data? Send us a message and we&apos;ll
            get back to you. We typically reply within 1&ndash;2 business days.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            {/* Form */}
            <ContactForm />

            {/* Direct channels + details */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Email us directly</p>
                <a href={`mailto:${LEGAL.contactEmail}`} className="mt-1 block font-display text-lg font-bold text-slate-900 hover:text-accent">
                  {LEGAL.contactEmail}
                </a>
                <p className="mt-1 text-sm text-slate-600">The fastest way to reach a human.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">What can we help with?</p>
                <ul className="mt-3 space-y-3">
                  {CHANNELS.map((c) => (
                    <li key={c.k} className="text-sm">
                      <span className="font-semibold text-slate-800">{c.k}</span>
                      <span className="mt-0.5 block text-slate-500">{c.d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Business details</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{LEGAL.entity}</p>
                {LEGAL.cin && <p className="text-sm text-slate-500">{LEGAL.cin}</p>}
                <p className="mt-1 text-sm text-slate-500">{LEGAL.address}</p>
                {LEGAL_PLACEHOLDERS_PRESENT && (
                  <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
                    Placeholder details &mdash; to be finalised before go-live.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <Link href="/legal/privacy" className="hover:text-slate-700">Privacy</Link>
                  <Link href="/legal/terms" className="hover:text-slate-700">Terms</Link>
                  <Link href="/legal/refunds" className="hover:text-slate-700">Refunds</Link>
                  <Link href="/legal/acceptable-use" className="hover:text-slate-700">Acceptable Use</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
