import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import type { BillingTier } from "@/lib/billing/plans";
import { effectiveTiers, getSignupOffer } from "@/lib/billing/pricing";
import { getActionCosts } from "@/lib/billing/actionCosts";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

// The five specialist agents, described in plain operator language rather than
// framework jargon. This is the "hub-and-spoke" ecosystem: an Orchestrator that
// delegates to four specialists running a Perceive → Reason → Act loop.
const AGENTS = [
  {
    n: "01",
    name: "Orchestrator",
    role: "Reads the goal, runs the crew",
    body: "Interprets a high-level objective, holds the context across every specialist, and delegates the work — so you brief once, not five times.",
  },
  {
    n: "02",
    name: "Audience & Analytics",
    role: "Knows who to target",
    body: "Runs the queries, segments your customers by recency, frequency and spend (RFM), and scores churn risk — so campaigns aim at the right people.",
  },
  {
    n: "03",
    name: "Creative & Multimodal",
    role: "Writes and renders the ads",
    body: "Long-form copy, content briefs and search-ready structured content, paired with cinematic short-form video ads, viral hooks and product animations.",
  },
  {
    n: "04",
    name: "Channel Execution",
    role: "Ships it everywhere",
    body: "Posts to Google Business Profile, distributes across social, and runs the customer lifecycle email — search, social, paid and inbox from one place.",
  },
  {
    n: "05",
    name: "Analytics & Reporting",
    role: "Watches and reports",
    body: "Ingests conversions, flags campaign drift the moment it starts, and builds real-time, white-label executive dashboards your clients can log into.",
  },
];

const TIERS = [
  {
    audience: "Solopreneurs & creators",
    title: "A one-click campaign kit",
    body: "Drop in a website or Shopify URL and get a complete kit back — social copy, a UGC-style video ad concept, a newsletter and an email sequence. No retainer, no agency overhead.",
  },
  {
    audience: "SMEs",
    title: "Marketing that runs itself",
    body: "Automated lifecycle marketing, local SEO and Google Business Profile posting, churn-risk intervention, and budget pacing — the day-to-day handled while you run the business.",
  },
  {
    audience: "Agencies & enterprises",
    title: "White-label the whole engine",
    body: "Multi-tenant client isolation, a custom domain of your own (marketing.youragency.com), agency-branded PDF reports and client portals, and a sub-account for every client.",
  },
];

const PRA_STEPS = [
  {
    phase: "Perceive",
    title: "It reads your market",
    body: "The audience agent pulls your customer data and the creative agent reads your landing page — so every play starts from what's actually true about your business.",
  },
  {
    phase: "Reason",
    title: "It decides the play",
    body: "The orchestrator turns your objective into a plan: who to target, which channels, what to say — a reasoning loop, not a single prompt.",
  },
  {
    phase: "Act",
    title: "It produces the campaign",
    body: "Copy, video, audience segments and channel posts are generated and staged — search, social, paid and email — ready for your review.",
  },
  {
    phase: "Approve",
    title: "You stay in control",
    body: "Nothing ships on its own. You review the campaign on one card and approve with a click — the only step SkirrNow never automates.",
  },
];

const FEATURES = [
  {
    title: "Free Product-to-Ad generator",
    body: "Paste a URL, verify your email and phone, and walk away with 3 viral hooks, an AI marketing audit, and a short animated ad teaser — the fastest way to see what SkirrNow does.",
  },
  {
    title: "RFM audience segmentation",
    body: "Recency, frequency and monetary quintiles plus churn-risk scoring, so outreach targets the customers most likely to convert or leave.",
  },
  {
    title: "Cinematic short-form video",
    body: "Character-consistent product animations and viral video ads generated in a low-cost draft, so you preview the idea before you spend on the final render.",
  },
  {
    title: "Multi-channel execution",
    body: "Google Business Profile posts, social distribution and lifecycle email — the channel agent ships to all of them from one workflow.",
  },
  {
    title: "White-label & multi-tenant",
    body: "Every client is isolated by organization, with a custom domain, agency-branded reports, and per-client sub-accounts. Run many brands from one seat.",
  },
  {
    title: "Hard credit guardrail",
    body: "A strict monthly generation cap on a shared pool. Over budget? The copy still ships — the render waits. No surprise spend, ever.",
  },
];

// Pricing is derived from the effective billing catalog (code defaults +
// platform-admin overrides), so the marketing page and the in-app billing
// screen never drift. INR (₹).
function buildPricing(tiers: BillingTier[], videoCost: number) {
  return tiers.map((t, i) => {
    const videos = videoCost > 0 ? Math.floor(t.creditsPerMonth / videoCost) : 0;
    return {
      name: t.name,
      price: inr(t.priceInr),
      period: "/mo",
      tagline: t.tagline,
      features: [
        `${t.creditsPerMonth} media credits / month — up to ~${videos} short videos`,
        `Video from ~${videoCost} credits (more for longer or HD clips)`,
        `${t.landingPages} landing ${t.landingPages === 1 ? "page" : "pages"}`,
        ...t.features,
      ],
      cta: `Choose ${t.name}`,
      highlight: i === 1, // Growth = most popular
    };
  });
}

const FAQ = [
  {
    q: "Is the free audit really free?",
    a: "Yes. Verify your email and phone (a one-time code) and you get 3 viral hooks, an AI marketing audit and a short animated teaser — no card required. Verification keeps out bots so the free render goes to real business owners. Paid plans unlock full-resolution, unwatermarked video and the automated email sequence.",
  },
  {
    q: "What are the agents, exactly?",
    a: "SkirrNow coordinates five specialists — an Orchestrator that runs the plan, plus Audience & Analytics, Creative & Multimodal, Channel Execution, and Reporting. They work as one crew on a Perceive → Reason → Act loop, so you brief a goal and they handle the rest.",
  },
  {
    q: "Can I run this as my own agency, white-labeled?",
    a: "Yes. Agencies get multi-tenant client isolation, a custom domain (marketing.youragency.com), agency-branded PDF reports and client portals, and a sub-account per client. Your clients never see SkirrNow.",
  },
  {
    q: "Can I use the landing pages on my own domain?",
    a: "Yes. Each landing page is a single self-contained HTML file — preview it in-app, then download it and host it anywhere: your own web host (cPanel/File Manager), or a drag-and-drop static host like Netlify, Vercel or Cloudflare Pages, then point your domain or subdomain at it. Just edit the call-to-action link to your destination before publishing. One-click hosted publishing is on the roadmap.",
  },
  {
    q: "Does anything get sent automatically?",
    a: "No outbound send is automatic. SkirrNow drafts, renders and previews; delivery only happens after your one-click approval.",
  },
  {
    q: "How does the credit guardrail work?",
    a: "Media generation draws from a shared monthly credit pool with a hard cap. If a job would exceed it, the copy is still produced and the render is held as a draft — you never overspend by accident.",
  },
];

// ISR: serve cached HTML but pick up admin pricing/offer edits within ~30s.
export const revalidate = 30;

export default async function HomePage() {
  const [tiers, offer, actionCosts] = await Promise.all([
    effectiveTiers(),
    getSignupOffer(),
    getActionCosts(),
  ]);
  const PRICING = buildPricing(tiers, actionCosts.video);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <p className="mb-5 inline-flex items-center rounded border border-slate-200 px-3 py-1 font-mono text-xs uppercase tracking-widest text-accent">
          Agentic marketing operating system
        </p>
        <h1 className="max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
          Your marketing team is now a team of AI agents.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
          SkirrNow Launch OS runs a coordinated crew of autonomous agents that plan, produce, optimize and
          distribute your campaigns across search, social, paid ads and email. They perceive your market,
          reason about the play, and act — from a single URL to a shipped campaign.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/free"
            className="rounded bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Get your free AI Marketing Audit
          </Link>
          <Link
            href="/#agents"
            className="rounded border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Meet the agents
          </Link>
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-slate-400">
          Free audit · Verify email + phone · No card · Human approval before anything ships
        </p>
      </section>

      {/* Free Product-to-Ad generator band */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
                Free · Product-to-Ad generator
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Paste your website. Walk away with an ad.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-slate-600">
                We read your landing page, write three high-converting viral hooks, hand you an AI marketing
                audit, and render a short animated ad teaser. Verify your email and phone to unlock it — paid
                plans render the full-resolution, unwatermarked video and the automated email sequence.
              </p>
              <Link
                href="/free"
                className="mt-7 inline-flex rounded bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Generate my free ad →
              </Link>
            </div>
            <ol className="space-y-4">
              {[
                ["Paste your URL", "Your site or Shopify link — that's the whole brief."],
                ["Verify email + phone", "A one-time code keeps it real. No bots, no spam."],
                ["Get hooks + audit", "Three viral hooks and an instant AI marketing audit report."],
                ["Watch your teaser", "A short animated ad, rendered on the house. Upgrade for full-res."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4 rounded border border-slate-200 bg-slate-50 p-4">
                  <span className="font-mono text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="font-semibold text-slate-900">{t}</div>
                    <div className="mt-1 text-sm leading-relaxed text-slate-600">{b}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* The agent ecosystem */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">The agent ecosystem</p>
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Five specialists. One orchestrated loop.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          A hub-and-spoke crew: an Orchestrator interprets your goal and delegates to four specialists, each an
          expert at one part of the campaign.
        </p>
        <div className="mt-10 grid gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.n} className="bg-slate-50 p-6">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-accent">{a.role}</span>
                <span className="font-mono text-xs text-slate-400">{a.n}</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">{a.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.body}</p>
            </div>
          ))}
          <div className="hidden bg-slate-50 p-6 lg:block">
            <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Hub &amp; spoke</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              You brief the Orchestrator once. It holds the context and hands work to the specialist that fits —
              the way a real agency runs, minus the retainer.
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for — three tiers */}
      <section id="tiers" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">Built for every operator</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Solo, SME, or a full agency — one OS.
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {TIERS.map((t) => (
              <div key={t.audience} className="flex flex-col rounded border border-slate-200 bg-slate-50 p-7">
                <div className="font-mono text-xs uppercase tracking-wider text-accent">{t.audience}</div>
                <h3 className="mt-3 font-display text-xl font-semibold text-slate-900">{t.title}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-slate-600">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — Perceive / Reason / Act */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">Perceive · Reason · Act</p>
        <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          The loop behind every campaign.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          The agents run in the background — you stay in control at the only step that matters: approval.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRA_STEPS.map((s) => (
            <div key={s.phase} className="rounded border border-slate-200 bg-white p-6">
              <div className="font-mono text-xs uppercase tracking-wider text-accent">{s.phase}</div>
              <h3 className="mt-2 font-display text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">What&apos;s inside</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything the crew needs, built in.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded border border-slate-200 p-6">
                <div className="mb-3 h-1.5 w-8 rounded bg-accent" />
                <h3 className="font-display text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">Pricing</p>
        <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Start free. Scale in ₹.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          The Product-to-Ad audit is free. Paid plans set your monthly media-credit allowance and unlock
          full-resolution video, multi-channel execution and white-label. Billed monthly in Indian Rupees.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          One shared credit pool — video from ~{actionCosts.video} credits (rises with clip length, resolution
          and quality), image {actionCosts.image} credits. Ad copy and landing pages cost no credits.
        </p>
        {offer.offerActive && offer.offerLabel && (
          <div className="mt-6 inline-flex items-center gap-2 rounded border border-accent bg-blue-50 px-4 py-2.5 text-sm font-medium text-accent">
            <span aria-hidden className="font-bold">★</span>
            {offer.offerLabel}
          </div>
        )}
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded border bg-white p-7 ${
                p.highlight ? "border-accent ring-1 ring-accent" : "border-slate-200"
              }`}
            >
              {p.highlight && (
                <span className="mb-3 inline-block w-fit rounded bg-blue-50 px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-accent">
                  Most popular
                </span>
              )}
              <div className="font-mono text-xs uppercase tracking-wider text-slate-500">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-slate-900">{p.price}</span>
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
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">FAQ</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Questions, answered.
          </h2>
          <div className="mt-8 divide-y divide-slate-200">
            {FAQ.map((f) => (
              <div key={f.q} className="py-5">
                <h3 className="font-display font-semibold text-slate-900">{f.q}</h3>
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
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Ready to put the agents to work?
            </h2>
            <p className="mt-2 text-slate-300">
              Paste a URL, verify your details, and we&apos;ll show you hooks, an audit and a teaser — free.
            </p>
          </div>
          <Link
            href="/free"
            className="rounded bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Get your free audit
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
