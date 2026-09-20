import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

/** Public marketing footer. */
export default function SiteFooter() {
  const { userId } = auth();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        {/* Mark + crisp HTML tagline — sharp and legible at any size, themeable. */}
        <div className="flex flex-col items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png?v=2" alt="SkirrNow" className="h-10 w-auto sm:h-11" />
          <span className="font-display text-sm font-medium tracking-[0.12em] text-slate-600">
            Marketing Momentum Masters
          </span>
        </div>
        <p className="text-sm text-slate-500">
          The autonomous AI ad agency.
        </p>
        <div className="flex gap-5 text-sm text-slate-500">
          <Link href="/#pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/get-started" className="hover:text-slate-900">Get started</Link>
          <Link href="/contact" className="hover:text-slate-900">Contact</Link>
          <Link href={userId ? "/dashboard" : "/sign-in"} className="hover:text-slate-900">{userId ? "Dashboard" : "Sign in"}</Link>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 py-4 text-xs text-slate-400">
          <Link href="/legal/privacy" className="hover:text-slate-700">Privacy Policy</Link>
          <Link href="/legal/terms" className="hover:text-slate-700">Terms of Use</Link>
          <Link href="/legal/refunds" className="hover:text-slate-700">Refund &amp; Cancellation</Link>
          <Link href="/legal/acceptable-use" className="hover:text-slate-700">Acceptable Use</Link>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} SkirrNow. All rights reserved.
      </div>
    </footer>
  );
}
