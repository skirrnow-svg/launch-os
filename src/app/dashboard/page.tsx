import Link from "next/link";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardHome() {
  const { user, org } = await getContext();
  const projectCount = await prisma.projects.count({
    where: { org_id: org.id, deleted_at: null },
  });
  const firstName = (user.name ?? user.email).split(/[@ ]/)[0];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back, {firstName}</h1>
      <p className="text-slate-500 mt-1">Workspace: {org.name}</p>

      <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-3xl font-extrabold tabular-nums">{projectCount}</div>
          <div className="text-sm text-slate-500 mt-1">Projects</div>
        </div>
        <Link
          href="/dashboard/projects"
          className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-center hover:border-indigo-400 transition-colors"
        >
          <div className="font-semibold text-indigo-600">Manage projects →</div>
          <div className="text-sm text-slate-500 mt-1">Create and organize launches</div>
        </Link>
      </div>
    </div>
  );
}
