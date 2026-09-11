import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import GetStartedForm from "@/components/site/GetStartedForm";

export const runtime = "edge";

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="mb-4 inline-flex items-center rounded bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
            Get started
          </p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            Tell us about your business. Get sample creative back.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Fill this in and SkirrNow&apos;s autonomous agency takes over: it verifies your details, checks the
            claims for compliance, and prepares a cold-outreach email plus a concept video — for your review.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-sm text-slate-600">
            {[
              "Verified before any outreach — phone, metro, and claims checked",
              "Sample email + concept video, generated automatically",
              "Nothing is sent until a human approves it",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 font-bold text-accent">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <GetStartedForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
