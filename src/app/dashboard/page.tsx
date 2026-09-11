"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

/**
 * Dashboard home — a client shell. It reads its summary from /api/org instead
 * of doing Clerk + Prisma work during server render, so the page itself never
 * trips the free-tier edge Worker's cold-start limit (a slow API call degrades
 * to a brief loading state, not a full-page 1102).
 */
type Budget = { cap: number | null; used: number; remaining: number | null };

export default function DashboardHome() {
  const router = useRouter();
  const { user } = useUser();
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setOrgName(d.org?.name ?? "");
        const count = typeof d.projectCount === "number" ? d.projectCount : 0;
        setProjectCount(count);
        setBudget(d.budget ?? null);
        const onboarded = document.cookie.split("; ").some((c) => c === "lo_onboarded=1");
        if (count === 0 && !onboarded) router.push("/dashboard/onboarding");
      })
      .catch(() => setProjectCount(0));
    return () => {
      active = false;
    };
  }, [router]);

  const firstName = (user?.firstName || user?.primaryEmailAddress?.emailAddress || "there").split(/[@ ]/)[0];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back, {firstName}</h1>
      <p className="text-slate-500 mt-1">{orgName ? `Workspace: ${orgName}` : " "}</p>

      <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-3xl font-extrabold tabular-nums">
            {projectCount == null ? "…" : projectCount}
          </div>
          <div className="text-sm text-slate-500 mt-1">Projects</div>
        </div>
        <Link
          href="/dashboard/projects"
          className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-center hover:border-indigo-400 transition-colors"
        >
          <div className="font-semibold text-indigo-600">Manage projects →</div>
          <div className="text-sm text-slate-500 mt-1">Create and organize launches</div>
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-3xl font-extrabold tabular-nums">
            {budget == null ? "…" : budget.cap == null ? "∞" : budget.remaining}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {budget?.cap == null ? "Generation credits (no cap)" : `Credits left of ${budget.cap}`}
          </div>
        </div>
      </div>
    </div>
  );
}
