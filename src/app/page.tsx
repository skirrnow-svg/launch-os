import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { BILLING_TIERS } from "@/lib/billing/plans";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");


const STEPS = [
  {
    n: "01",
    title: "A prospect replies",
    body: "An inbound email — or a form on your own site — lands in SkirrNow. We read the intent in seconds.",
  },
  {
    n: "02",
    title: "Auto-qualify & verify",
    body: "We extract the business, validate the phone and metro, and run a compliance check against deceptive-claim risk — before you lift a finger.",
  },
  {
    n: "03",
    title: "Autonomous sample creative",
    body: "For qualified leads we generate a cold-outreach email and a short concept video, provisioning a workspace and project automatically.",
  },
  {
    n: "04",
    title: "One-click approve & deliver",
    body: "You review the verified lead and the sample creative on one card, then approve. Nothing goes out without your say-so.",
  },
];

const FEATURES = [
  {
    title: "Instant pitch generator",
    body: "Paste a prospect and get a qualified, verified, legally-cleared sample ad in minutes — the fastest way to walk into a pitch already holding the creative.",
  },
  {
    title: "Inbound lead triage",
    body: "Keyword intent classification routes every reply — interested, question, or unsubscribe — the moment it arrives.",
  },
  {
    title: "Verification & legal guardrails",
    body: "E.164 phone checks, metro-consistency, and an AI compliance review that flags unsubstantiated claims before they ship.",
  },
  {
    title: "AI copy that sounds human",
    body: "Cold-outreach emails and social posts written by Claude on your own subscription — no metered API keys.",
  },
  {
    title: "Concept video & images",
    body: "Short-form concept videos and images via Higgsfield, generated in a low-cost draft so you can preview the idea fast.",
  },
  {
    title: "Multi-tenant workspaces",
    body: "Every client is isolated by organization. Run many brands from one seat, each with its own projects and assets.",
  },
  {
    title: "Hard credit guardrail",
    body: "A strict monthly generation cap per pool. Over budget? The copy still ships — the render waits. No surprise spend.",
  },
];

// Pricing is derived from the single billing catalog (src/lib/billing/plans.ts),
// so the marketing page and the in-app billing screen never drift. Amounts are
// in INR (₹).
const PRICING = BILLING_TIERS.map((t, i) => ({
  name: t.name,
  price: inr(t.priceInr),
  period: "/mo",
  tagline: t.tagline,
  features: [`${t.creditsPerMonth} credits / month`, ...t.features],
  cta: `Choose ${t.name}`,
  highlight: i === 1, // Growth = most popular
}));

const FAQ = [
  {
    q: "Do I need to pay for AI API keys?",
    a: "No. SkirrNow runs generation on your Claude and Higgsfield subscriptions via a background worker — there are no per-token API bills.",
  },
  {
    q: "How does the credit guardrail work?",
    a: "Media generation draws from a shared monthly credit pool with a hard cap. If a job would exceed it, the copy is still produced and the render is held as a draft — you never overspend by accident.",
  },
  {
    q: "Is my client data isolated?",
    a: "Yes. Every project, lead, and asset is scoped to its organization. One client can never see another's data.",
  },
  {
    q: "Does anything get sent automatically?",
    a: "No outbound send is automatic. SkirrNow drafts and previews; delivery only happens after your one-click approval.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
        <p className="mb-4 inline-flex items-center rounded bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          The autonomous AI ad agency
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Turn a single reply into a ready-to-send campaign — automatically.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          SkirrNow qualifies inbound leads, verifies the business, checks the claims for legal risk, and
          produces sample ad copy and a concept video — then hands you a one-click approve gate. It runs on
          your own Claude and Higgsfield subscriptions, so there are no metered API bills.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/get-started"
            className="rounded bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Get started
          </Link>
          <Link
            href="/#how"
            className="rounded border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            See how it works
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          No API keys · Runs on your own subscriptions · Human approval before anything ships
        </p>
      </section>

      {/* Trust strip */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 text-center sm:grid-cols-4">
          {[
            ["Seconds", "to triage a reply"],
            ["100%", "leads verified before outreach"],
            ["1 click", "to approve & deliver"],
            ["₹0", "in AI API fees"],
          ].map(([big, small]) => (
            <div key={small}>
              <div className="text-2xl font-extrabold text-slate-900">{big}</div>
              <div className="mt-1 text-sm text-slate-500">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">From reply to campaign, on autopilot</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          A request-to-fulfil pipeline runs in the background. You stay in control at the only step that matters — approval.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded border border-slate-200 bg-white p-6">
              <div className="text-sm font-bold text-accent">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Everything the pipeline needs, built in</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded border border-slate-200 p-6">
                <div className="mb-3 h-1.5 w-8 rounded bg-accent" />
                <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Simple pricing, in ₹</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Generation runs on your own Claude &amp; Higgsfield subscriptions — no metered API bills. Each plan sets your
          monthly media-credit allowance. Billed monthly in Indian Rupees.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded border bg-white p-7 ${
                p.highlight ? "border-accent ring-1 ring-accent" : "border-slate-200"
              }`}
            >
              {p.highlight && (
                <span className="mb-3 inline-block w-fit rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-accent">
                  Most popular
                </span>
              )}
              <div className="text-sm font-medium text-slate-500">{p.name}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">{p.price}</span>
                {p.period && <span className="text-sm text-slate-500">{p.period}</span>}
              </div>
              <div className="mt-1 text-sm text-slate-500">{p.tagline}</div>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-slate-600">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 font-bold text-accent">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/get-started"
                className={`mt-7 rounded px-5 py-2.5 text-center text-sm font-semibold transition-colors ${
                  p.highlight
                    ? "bg-accent text-white hover:bg-accent-hover"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Questions, answered</h2>
          <div className="mt-8 divide-y divide-slate-200">
            {FAQ.map((f) => (
              <div key={f.q} className="py-5">
                <h3 className="font-semibold text-slate-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Ready to let the agency run itself?</h2>
            <p className="mt-2 text-slate-300">Send us a note — we&apos;ll show you a qualified lead with sample creative.</p>
          </div>
          <Link
            href="/get-started"
            className="rounded bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Get started
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
