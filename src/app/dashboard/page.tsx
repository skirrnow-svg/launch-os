/**
 * Dashboard (Phase 0 stub).
 * TODO(phase-1): gate behind Clerk auth (auth() / currentUser()), resolve the
 * active organization, and render real project/launch data from the database.
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
        Dashboard
      </h1>
      <p className="mb-8 text-slate-600">
        Your launches, assets, and campaign metrics will appear here.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {["Projects", "Assets", "Campaigns"].map((label) => (
          <div
            key={label}
            className="rounded border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">—</p>
            <p className="mt-1 text-xs text-slate-400">
              TODO(phase-1): live data
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
