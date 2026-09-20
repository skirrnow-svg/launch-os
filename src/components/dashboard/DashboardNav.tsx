"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrganizationSwitcher } from "@clerk/nextjs";

/**
 * Role-aware dashboard sidebar. Fetches /api/org once to learn the viewer's
 * role + org type, then:
 *   • shows "Admin" only to platform admins,
 *   • shows "Brand" only to agency (white-label) orgs or admins,
 *   • swaps the "Launch OS" wordmark for the agency's logo/brand name.
 */
type OrgInfo = {
  isAdmin: boolean;
  org: { name: string; accountType: string; brandName: string | null; logoUrl: string | null };
};

const BASE = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/pitch", label: "Instant Pitch" },
  { href: "/dashboard/audience", label: "Audience" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/usage", label: "Usage" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardNav() {
  const [info, setInfo] = useState<OrgInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/org").then((r) => r.json()).then((d) => { if (active) setInfo(d); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const isAdmin = info?.isAdmin ?? false;
  const isAgency = info?.org?.accountType === "agency";
  const brandName = info?.org?.brandName;
  const logoUrl = info?.org?.logoUrl;

  const nav = [
    ...BASE,
    ...(isAgency || isAdmin ? [{ href: "/dashboard/brand", label: "Brand" }] : []),
    ...(isAdmin ? [{ href: "/dashboard/admin", label: "Admin" }] : []),
    ...(isAdmin ? [{ href: "/dashboard/admin/visitors", label: "Visitors" }] : []),
  ];

  return (
    <>
      <div className="px-5 py-5 border-b border-slate-200">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName || "Workspace"} className="max-h-9 w-auto" />
        ) : (
          <div className="truncate font-display text-lg font-bold tracking-tight" title={isAgency && brandName ? brandName : "Launch OS"}>
            {isAgency && brandName ? brandName : "Launch OS"}
          </div>
        )}
        <div className="mt-2 max-w-full overflow-hidden">
          <OrganizationSwitcher
            hidePersonal={false}
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
            afterSelectPersonalUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full max-w-full",
                organizationSwitcherTrigger: "w-full max-w-full justify-between overflow-hidden",
                organizationPreview: "min-w-0",
                organizationPreviewTextContainer: "min-w-0",
                organizationPreviewMainIdentifier: "truncate",
                organizationPreviewSecondaryIdentifier: "truncate",
              },
            }}
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
    </>
  );
}
