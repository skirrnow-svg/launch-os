import Link from "next/link";

export const runtime = "edge";

/** Custom 404 — edge runtime so next-on-pages can build it. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">404</p>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">That page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-6 inline-block font-semibold text-indigo-600 hover:underline">
        ← Back home
      </Link>
    </main>
  );
}
