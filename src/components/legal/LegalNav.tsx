"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEGAL_PAGES } from "@/lib/legal";

/** Tab strip linking the four legal documents; highlights the active one. */
export default function LegalNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-1 px-6 py-2.5 text-sm">
        {LEGAL_PAGES.map((pg) => {
          const href = `/legal/${pg.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={pg.slug}
              href={href}
              className={
                active
                  ? "font-semibold text-slate-900"
                  : "text-slate-500 hover:text-slate-900"
              }
            >
              {pg.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
