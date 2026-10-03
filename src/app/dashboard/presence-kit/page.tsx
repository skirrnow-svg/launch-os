"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * AI Presence Kit (Module 1).
 *
 * One flow: describe a business → one dispatch produces a landing page (Claude,
 * free) + social graphics and a short video (Higgsfield, on the runner). Cost is
 * previewed and confirmed before any media spend (the 200-credit/month cap is
 * enforced server-side). Styling matches the dashboard (inverted slate + indigo).
 */
type Breakdown = {
  images: { count: number; each: number };
  videos: { count: number; each: number };
  landingPage: number;
};
type ConfirmResp = { status: "confirmation-required"; estimatedCredits: number; breakdown: Breakdown; provider: string };
type CreatedResp = { kit: { id: string; status: string }; projectId: string; landingPageId: string; assetIds: string[]; estimatedCredits: number; contactsQueuedForReview: number };

const inputCls =
  "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default function PresenceKitPage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"form" | "confirm" | "working" | "done" | "blocked">("form");
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<ConfirmResp | null>(null);
  const [created, setCreated] = useState<CreatedResp | null>(null);
  const [blockedMsg, setBlockedMsg] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function payload(confirmed: boolean) {
    const photoUrls = (form.photoUrls || "")
      .split(/[\n,]+/).map((u) => u.trim()).filter(Boolean);
    const contacts = (form.reviewEmail || "").trim()
      ? [{ email: form.reviewEmail.trim() }]
      : [];
    return {
      businessName: form.businessName?.trim() || "",
      category: form.category?.trim() || "",
      location: form.location?.trim() || "",
      phone: form.phone?.trim() || "",
      googlePlaceUrl: form.googlePlaceUrl?.trim() || "",
      photoUrls,
      contacts,
      confirmed,
    };
  }

  async function getQuote(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.businessName?.trim()) {
      setError("A business name is required.");
      return;
    }
    try {
      const res = await fetch("/api/presence-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(false)),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setQuote(data as ConfirmResp);
      setPhase("confirm");
    } catch {
      setError("Network error — please try again.");
    }
  }

  async function confirmGenerate() {
    setError("");
    setPhase("working");
    try {
      const res = await fetch("/api/presence-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(true)),
      });
      const data = await res.json();
      if (data?.status === "budget-exceeded") {
        setBlockedMsg(data.message || "Monthly generation budget reached.");
        setPhase("blocked");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setPhase("confirm");
        return;
      }
      setCreated(data as CreatedResp);
      setPhase("done");
    } catch {
      setError("Network error — please try again.");
      setPhase("confirm");
    }
  }

  function reset() {
    setForm({});
    setQuote(null);
    setCreated(null);
    setError("");
    setBlockedMsg("");
    setPhase("form");
  }

  const FIELDS = [
    { k: "businessName", label: "Business name", ph: "Acme Dental", required: true },
    { k: "category", label: "Category", ph: "Cosmetic dentistry", required: false },
    { k: "location", label: "City / metro", ph: "Pune", required: false },
    { k: "phone", label: "Phone (optional)", ph: "+91 90000 00000", required: false },
    { k: "googlePlaceUrl", label: "Google listing URL (optional)", ph: "https://g.page/…", required: false },
    { k: "reviewEmail", label: "Send a review request to (optional)", ph: "customer@email.com", required: false },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight">AI Presence Kit</h1>
      <p className="text-slate-500 mt-1">
        Describe a business. One click produces a landing page, social graphics and a short video — generated on the
        runner, so nothing spends until you confirm.
      </p>

      {phase === "form" && (
        <form onSubmit={getQuote} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 grid gap-4">
          {FIELDS.map((f) => (
            <label key={f.k} className="block">
              <span className="text-sm font-medium text-slate-700">
                {f.label}
                {f.required && <span className="text-indigo-600"> *</span>}
              </span>
              <input value={form[f.k] || ""} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} className={inputCls} />
            </label>
          ))}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Photo URLs (optional, one per line)</span>
            <textarea
              value={form.photoUrls || ""}
              onChange={(e) => set("photoUrls", e.target.value)}
              placeholder="https://…/storefront.jpg"
              rows={2}
              className={inputCls}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="mt-2 rounded-xl bg-indigo-600 text-white font-semibold py-2.5 hover:bg-indigo-700 transition-colors">
            Preview the kit &amp; cost
          </button>
          <p className="text-xs text-slate-400">The landing page and copy are free. Graphics and video draw from your monthly generation credits — you&apos;ll see the exact estimate next.</p>
        </form>
      )}

      {phase === "confirm" && quote && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Confirm generation</div>
          <div className="mt-3 text-sm text-slate-600 space-y-1">
            <div className="flex justify-between"><span>Landing page (copy)</span><span className="font-medium text-slate-800">free</span></div>
            <div className="flex justify-between"><span>Social graphics × {quote.breakdown.images.count}</span><span className="font-medium text-slate-800">{quote.breakdown.images.count * quote.breakdown.images.each} cr</span></div>
            <div className="flex justify-between"><span>Short video × {quote.breakdown.videos.count}</span><span className="font-medium text-slate-800">{quote.breakdown.videos.count * quote.breakdown.videos.each} cr</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 mt-2 text-base"><span className="font-semibold text-slate-800">Estimated total</span><span className="font-bold text-indigo-600">{quote.estimatedCredits} credits</span></div>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={confirmGenerate} className="rounded-xl bg-indigo-600 text-white font-semibold px-4 py-2.5 text-sm hover:bg-indigo-700 transition-colors">
              Generate the kit (~{quote.estimatedCredits} credits)
            </button>
            <button onClick={() => setPhase("form")} className="text-sm font-medium text-slate-500 hover:text-slate-800">Back</button>
          </div>
        </div>
      )}

      {phase === "working" && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="text-lg font-semibold">Queuing your presence kit…</div>
          <p className="text-slate-500 mt-1 text-sm">Landing page + graphics + video are dispatched to the runner. This usually takes a few minutes.</p>
          <div className="mt-4 inline-block h-1.5 w-40 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" /></div>
        </div>
      )}

      {phase === "blocked" && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="font-bold text-amber-800">Generation budget reached</div>
          <p className="text-sm text-amber-700 mt-0.5">{blockedMsg} The landing page and copy still work; the media render waits until the budget resets or you upgrade.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/dashboard/billing" className="rounded-xl bg-indigo-600 text-white font-semibold px-4 py-2.5 text-sm hover:bg-indigo-700">View plans</Link>
            <button onClick={() => setPhase("confirm")} className="text-sm font-medium text-slate-500 hover:text-slate-800">Back</button>
          </div>
        </div>
      )}

      {phase === "done" && created && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="font-bold text-emerald-800">✓ Kit queued</div>
            <p className="text-sm text-emerald-700 mt-0.5">
              Your landing page, {created.assetIds.length} media asset{created.assetIds.length === 1 ? "" : "s"}
              {created.contactsQueuedForReview ? ` and ${created.contactsQueuedForReview} review request` : ""} are generating on the runner.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center gap-3">
            <Link href={`/dashboard/projects/${created.projectId}/landing`} className="rounded-xl bg-indigo-600 text-white font-semibold px-4 py-2.5 text-sm hover:bg-indigo-700 transition-colors">
              View landing page →
            </Link>
            <Link href={`/dashboard/projects/${created.projectId}/assets`} className="text-sm font-medium text-indigo-600 hover:underline">
              Watch graphics &amp; video
            </Link>
            <button onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-800 ml-auto">New kit</button>
          </div>
        </div>
      )}
    </div>
  );
}
