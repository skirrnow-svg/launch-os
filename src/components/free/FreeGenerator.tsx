"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Step = "start" | "signup" | "working" | "done" | "error" | "paywall";

type Report = {
  business?: { name?: string; what?: string };
  hooks?: string[];
  audit?: {
    headline?: string;
    summary?: string;
    strengths?: string[];
    gaps?: string[];
    recommendations?: string[];
  };
};

const card = "rounded border border-slate-200 bg-white p-6 sm:p-8";
const input =
  "w-full rounded border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const label = "mb-1.5 block text-sm font-medium text-slate-700";
const eyebrow = "font-mono text-xs uppercase tracking-widest text-accent";

/**
 * The free Product-to-Ad generator: paste a URL → (free account, no credit
 * card) → 3 viral hooks + an AI marketing audit. Each account gets 2 free ads,
 * then a payment wall. A free signup is the gate — no email code.
 */
export default function FreeGenerator({ isSignedIn }: { isSignedIn: boolean }) {
  const [step, setStep] = useState<Step>("start");
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function generate(e: FormEvent) {
    e.preventDefault();
    // Gate: a free account (no credit card) is required to generate.
    if (!isSignedIn) { setStep("signup"); return; }
    setBusy(true);
    setError("");
    setStep("working");
    try {
      const res = await fetch("/api/public/free/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.status === 401 && data.needsSignup) { setStep("signup"); return; }
      if (res.status === 402 && data.needsPayment) { setStep("paywall"); return; }
      if (!res.ok) throw new Error(data.error || "Couldn't start your audit.");
      startPolling(data.lead_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  function startPolling(id: string) {
    let tries = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/public/free/${id}`);
        const data = await res.json();
        if (data.state === "ready" && data.report) {
          if (pollRef.current) clearInterval(pollRef.current);
          setReport(data.report);
          setStep("done");
        } else if (data.state === "failed" || tries > 40) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data.error || "This is taking longer than expected. Please try again.");
          setStep("error");
        }
      } catch {
        /* transient — keep polling */
      }
    }, 3000);
  }

  // ---- Step: paste your website ----------------------------------------------
  if (step === "start") {
    return (
      <form onSubmit={generate} className={card}>
        <p className={eyebrow}>Paste your website</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">Get your ad in a minute</h2>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;ll read your landing page and write three viral hooks plus an AI marketing audit — free.
        </p>
        {error && <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-6">
          <label className={label} htmlFor="fg-url">Website or Shopify URL</label>
          <input
            id="fg-url" className={input} value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbrand.com" inputMode="url" autoComplete="url" spellCheck={false} required
          />
        </div>
        <button type="submit" disabled={busy} className="mt-6 w-full rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
          {isSignedIn ? "Generate my ad →" : "Continue — free account →"}
        </button>
        {!isSignedIn && (
          <p className="mt-3 text-center text-xs text-slate-400">Free account, no credit card. Your first 2 ads are on us.</p>
        )}
      </form>
    );
  }

  // ---- Step: needs a free account --------------------------------------------
  if (step === "signup") {
    return (
      <div className={`${card} text-center`}>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-xl text-accent">✦</div>
        <h2 className="font-display text-xl font-bold text-slate-900">Create your free account</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          No credit card — just a free account to keep your ads and audits in one place. Your first 2 Product-to-Ad
          audits are free.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/sign-up?redirect_url=/free" className="inline-block rounded bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
            Sign up free →
          </a>
          <a href="/sign-in?redirect_url=/free" className="inline-block rounded border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
            I already have an account
          </a>
        </div>
        <button type="button" onClick={() => setStep("start")} className="mt-4 text-xs text-slate-400 hover:text-slate-600">
          ← Back
        </button>
      </div>
    );
  }

  // ---- Step: free ads used up -> payment wall ---------------------------------
  if (step === "paywall") {
    return (
      <div className={`${card} text-center`}>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-xl text-accent">★</div>
        <h2 className="font-display text-xl font-bold text-slate-900">You&apos;ve used your 2 free ads</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Your account has generated its 2 free Product-to-Ad audits. Upgrade to a paid plan to generate unlimited
          ads, unlock full-resolution animated videos, and automate your follow-up email sequence.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/#pricing" className="inline-block rounded bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
            See paid plans →
          </a>
          <a href="/get-started" className="inline-block rounded border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
            Talk to us
          </a>
        </div>
      </div>
    );
  }

  // ---- Step: generating -------------------------------------------------------
  if (step === "working") {
    return (
      <div className={`${card} text-center`}>
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-accent" />
        <h2 className="font-display text-xl font-bold text-slate-900">Reading your site &amp; writing your ad…</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Our creative agent is analysing your landing page and drafting three hooks plus your audit. This takes
          up to a minute — hang tight.
        </p>
      </div>
    );
  }

  // ---- Step: error ------------------------------------------------------------
  if (step === "error") {
    return (
      <div className={`${card} text-center`}>
        <h2 className="font-display text-xl font-bold text-slate-900">That didn&apos;t work</h2>
        <p role="alert" className="mx-auto mt-2 max-w-md text-sm text-slate-600">{error}</p>
        <button onClick={() => { setStep("start"); setError(""); }} className="mt-6 rounded border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          Start over
        </button>
      </div>
    );
  }

  // ---- Step: the report -------------------------------------------------------
  const a = report?.audit ?? {};
  const hooks = report?.hooks ?? [];
  const bizName = report?.business?.name;
  return (
    <div className="space-y-6">
      <div className={card}>
        <p className={eyebrow}>Your AI marketing audit</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">
          {a.headline || `Here's your report${bizName ? `, ${bizName}` : ""}`}
        </h2>
        {a.summary && <p className="mt-3 leading-relaxed text-slate-600">{a.summary}</p>}
      </div>

      {hooks.length > 0 && (
        <div className={card}>
          <p className={eyebrow}>3 viral hooks</p>
          <ul className="mt-4 space-y-3">
            {hooks.map((h, i) => (
              <li key={i} className="flex gap-4 rounded border border-slate-200 bg-slate-50 p-4">
                <span className="font-mono text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-slate-900">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <AuditList title="Strengths" items={a.strengths} />
        <AuditList title="Gaps" items={a.gaps} />
        <AuditList title="Recommendations" items={a.recommendations} />
      </div>

      {/* Teaser upsell — the animated ad renders once phone verification lands. */}
      <div className="rounded border border-accent/40 bg-blue-50 p-6 sm:p-8">
        <p className={eyebrow}>Your animated ad teaser</p>
        <h3 className="mt-2 font-display text-xl font-bold text-slate-900">Want to see these hooks as a video?</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Verify your phone (coming soon) to unlock a free animated teaser, or upgrade to a paid plan for a
          full-resolution, unwatermarked ad plus the automated email sequence.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/#pricing" className="rounded bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
            See paid plans
          </a>
          <button type="button" onClick={() => { setReport(null); setUrl(""); setStep("start"); }} className="rounded border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
            Generate another
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={card}>
      <p className="font-mono text-xs uppercase tracking-wider text-accent">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
