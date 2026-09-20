import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BrandStudio from "@/components/brand/BrandStudio";
import VisitBeacon from "@/components/site/VisitBeacon";

export const metadata: Metadata = {
  title: "Brand Studio — brand any image, free | SkirrNow",
  description:
    "Drop in any image and stamp it on-brand with your logo, name, tagline and colors in seconds. Free, instant, no AI credits.",
};

export default function BrandStudioPage() {
  const { userId } = auth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <VisitBeacon path="brand-studio" />
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Free · Brand Studio</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
          Make any image on-brand in seconds.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
          Drop in a photo or video, add your logo, name, tagline and colors, and download a polished branded
          result — instant and entirely in your browser. Free with an account (no credit card); each creation draws
          from your monthly SkirrNow AI-token allowance.
        </p>
        <div className="mt-10">
          <BrandStudio isSignedIn={!!userId} />
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
