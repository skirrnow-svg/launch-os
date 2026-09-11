import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectMetricsPage({ params }: { params: { id: string } }) {
  const { org } = await getContext();
  if (!UUID.test(params.id)) notFound();
  const project = await prisma.projects.findFirst({
    where: { id: params.id, org_id: org.id, deleted_at: null },
  });
  if (!project) notFound();

  const [assets, campaigns, posts] = await Promise.all([
    prisma.assets.count({ where: { project_id: project.id } }),
    prisma.email_campaigns.count({ where: { project_id: project.id } }),
    prisma.social_posts.count({ where: { project_id: project.id } }),
  ]);

  const tiles = [
    { label: "Assets", value: assets },
    { label: "Email campaigns", value: campaigns },
    { label: "Social posts", value: posts },
  ];

  return (
    <div className="max-w-3xl">
      <Link href={`/dashboard/projects/${project.id}`} className="text-sm text-indigo-600 hover:underline">
        ← Project
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight mt-3">Metrics</h1>
      <p className="text-slate-500 mt-1">
        A snapshot of what&apos;s in this launch. Live engagement metrics (opens, clicks, reach)
        arrive with the Resend and Buffer integrations.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-3xl font-extrabold tabular-nums">{t.value}</div>
            <div className="text-sm text-slate-500 mt-1">{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
