import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getContext } from "@/lib/auth";

/**
 * Dashboard shell. Server component: calling getContext() here syncs a
 * first-time Clerk user into the DB and ensures their personal org exists
 * before any dashboard page renders.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { org } = await getContext();

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/projects", label: "Projects" },
    { href: "/dashboard/admin", label: "Admin" },
  ];

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr] bg-slate-50 text-slate-900">
      <aside className="border-r border-slate-200 bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="font-extrabold tracking-tight text-lg">Launch OS</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">{org.name}</div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <span className="text-xs text-slate-500">Account</span>
        </div>
      </aside>
      <main className="p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
