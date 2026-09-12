import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerkAppearance";
import DashboardNav from "@/components/dashboard/DashboardNav";


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
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <div className="min-h-screen grid grid-cols-[220px_1fr] bg-slate-50 text-slate-900">
        <aside className="border-r border-slate-200 bg-white flex flex-col">
          <DashboardNav />
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
