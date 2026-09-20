import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BrandStudio from "@/components/brand/BrandStudio";

export const metadata: Metadata = {
  title: "Brand Studio — brand any image, free | SkirrNow",
  description:
    "Drop in any image and stamp it on-brand with your logo, name, tagline and colors in seconds. Free, instant, no AI credits.",
};

export default function BrandStudioPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Free · Brand Studio</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
          Make any image on-brand in seconds.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
          Drop in a photo, add your logo, name, tagline and colors, and download a polished branded image —
          free, instant, and entirely in your browser. Video branding and your saved brand kit come with a
          free account.
        </p>
        <div className="mt-10">
          <BrandStudio />
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
