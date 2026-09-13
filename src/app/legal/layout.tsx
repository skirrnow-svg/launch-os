import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import LegalNav from "@/components/legal/LegalNav";

/**
 * Public shell for /legal/* pages — no Clerk (these must be readable by anyone,
 * including a payment-gateway reviewer). Light document theme to match the
 * marketing footer.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-slate-900">
            <span className="grid h-6 w-6 place-items-center rounded bg-accent text-xs font-black text-white">S</span>
            SkirrNow
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">&larr; Back to site</Link>
        </div>
      </header>
      <LegalNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
