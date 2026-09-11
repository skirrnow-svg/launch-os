import Link from "next/link";

export const runtime = "edge";

/**
 * Launch OS landing page (Phase 0 stub).
 * Brand: Slate neutrals + single Blue accent, Inter, no gradients, corners <= 8px.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
        Launch OS
      </p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        AI-native launch orchestration.
      </h1>
      <p className="mb-8 max-w-xl text-lg text-slate-600">
        Generate marketing assets with AI, orchestrate multi-channel campaigns,
        and track results — all in one multi-tenant workspace.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Open dashboard
        </Link>
        <Link
          href="/sign-in"
          className="rounded border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-12 text-sm text-slate-400">
        Phase 0 scaffold — see <code>New Instructions/</code> docs for the full spec.
      </p>
    </main>
  );
}
