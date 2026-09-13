import Link from "next/link";

/** Public marketing footer. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-extrabold tracking-tight text-slate-900">
          <span className="grid h-6 w-6 place-items-center rounded bg-accent text-xs font-black text-white">S</span>
          SkirrNow
        </div>
        <p className="text-sm text-slate-500">
          The autonomous AI ad agency.
        </p>
        <div className="flex gap-5 text-sm text-slate-500">
          <Link href="/#pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/get-started" className="hover:text-slate-900">Get started</Link>
          <Link href="/contact" className="hover:text-slate-900">Contact</Link>
          <Link href="/sign-in" className="hover:text-slate-900">Sign in</Link>
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
