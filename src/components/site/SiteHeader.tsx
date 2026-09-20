import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

/** Public marketing header. Anchors resolve to sections on the home page. */
export default function SiteHeader() {
  const { userId } = auth();
  const signedIn = !!userId;
  const nav = [
    { href: "/#how", label: "How it works" },
    { href: "/#features", label: "Features" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#faq", label: "FAQ" },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center" aria-label="SkirrNow — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SkirrNow" className="h-9 w-auto sm:h-10" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-slate-900">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              My dashboard →
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
                Sign in
              </Link>
              <Link
                href="/get-started"
                className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
