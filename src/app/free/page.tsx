import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import FreeGenerator from "@/components/free/FreeGenerator";

export const metadata: Metadata = {
  title: "Free Product-to-Ad Generator — SkirrNow",
  description:
    "Paste your website and get 3 viral hooks plus an AI marketing audit, free. Verify your email to unlock it.",
};

export default function FreePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Free · Product-to-Ad generator</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
          Paste your website. Walk away with an ad.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
          Our creative agent reads your landing page and writes three high-converting hooks plus an instant AI
          marketing audit — free. Verify your email and it&apos;s yours in under a minute.
        </p>
        <div className="mt-10">
          <FreeGenerator />
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
