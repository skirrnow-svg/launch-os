import Link from "next/link";
import { ClerkProvider, UserButton, OrganizationSwitcher } from "@clerk/nextjs";


/**
 * Dashboard shell — deliberately does NO server data work at render.
 *
 * It used to call getContext() (a Clerk network call + Prisma user/org
 * upsert) on every dashboard navigation, which dominated the edge Worker's
 * cold-start budget and tripped free-tier "Worker exceeded resource limits"
 * (1102). Provisioning already happens inside every API route's getContext(),
 * and the active org is shown by Clerk's <OrganizationSwitcher>, so the shell
 * itself needs no DB round-trips.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/projects", label: "Projects" },
    { href: "/dashboard/leads", label: "Leads" },
    { href: "/dashboard/billing", label: "Billing" },
    { href: "/dashboard/admin", label: "Admin" },
  ];

  return (
    <ClerkProvider>
      <div className="min-h-screen grid grid-cols-[220px_1fr] bg-slate-50 text-slate-900">
        <aside className="border-r border-slate-200 bg-white flex flex-col">
          <div className="px-5 py-5 border-b border-slate-200">
            <div className="font-extrabold tracking-tight text-lg">Launch OS</div>
            <div className="mt-2">
              <OrganizationSwitcher
                hidePersonal={false}
                afterCreateOrganizationUrl="/dashboard"
                afterSelectOrganizationUrl="/dashboard"
                afterSelectPersonalUrl="/dashboard"
              />
            </div>
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
    </ClerkProvider>
  );
}
