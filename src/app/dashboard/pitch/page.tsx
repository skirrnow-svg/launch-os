"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Instant Pitch Generator.
 *
 * Describe a prospect → the same qualify → verify → legal → sample-copy path
 * runs on the current org, producing a ready ad copy sample. The concept video
 * is an explicit next step (cost-previewed in the project's assets), so a pitch
 * never auto-spends media credits.
 */
type Lead = {
  id: string;
  status: string;
  source?: string;
  verification?: {
    extracted?: { company_name?: string; core_offer?: string; metro_area?: string; niche?: string };
    missing?: string[];
    legal_safe?: boolean;
    legal_issues?: string[];
  } | null;
  client_profile?: {
    project?: {
      id: string;
      name: string;
      email_campaigns?: { id: string; name: string; subject: string; template_html: string; status: string }[];
    } | null;
  } | null;
};

const FIELDS = [
  { k: "company", label: "Company / brand", ph: "Acme Dental", required: true },
  { k: "offer", label: "Offer or product", ph: "Invisible aligners, first consult free", required: true, area: true },
  { k: "niche", label: "Niche", ph: "Cosmetic dentistry", required: false },
  { k: "metro", label: "Metro / city", ph: "Pune", required: false },
  { k: "phone", label: "Phone (optional)", ph: "+91 90000 00000", required: false },
  { k: "email", label: "Contact email (optional)", ph: "owner@acme.com", required: false },
];

export default function PitchPage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"form" | "working" | "done">("form");
  const [error, setError] = useState("");
  const [lead, setLead] = useState<Lead | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function pollLead(leadId: string) {
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch("/api/leads");
        const data = await res.json();
        const found: Lead | undefined = (data.leads || []).find((l: Lead) => l.id === leadId);
        if (found && !["PENDING", "PROCESSING"].includes(found.status)) {
          setLead(found);
          setPhase("done");
          return;
        }
        if (found) setLead(found);
      } catch {
        /* keep polling */
      }
    }
    setPhase("done"); // timed out; show whatever we have
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.company?.trim() || !form.offer?.trim()) {
      setError("Company and offer are required.");
      return;
    }
    setPhase("working");
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setPhase("form");
        return;
      }
      await pollLead(data.lead_id);
    } catch {
      setError("Network error — please try again.");
      setPhase("form");
    }
  }

  function reset() {
    setForm({});
    setLead(null);
    setError("");
    setPhase("form");
  }

  const v = lead?.verification;
  const project = lead?.client_profile?.project ?? null;
  const campaign = project?.email_campaigns?.[0];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Instant pitch</h1>
      <p className="text-slate-500 mt-1">
        Describe a prospect. We qualify, verify, legal-check, and write sample ad copy — then you render a concept
        video only if it&apos;s worth it.
      </p>

      {phase === "form" && (
        <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 grid gap-4">
          {FIELDS.map((f) => (
            <label key={f.k} className="block">
              <span className="text-sm font-medium text-slate-700">
                {f.label}
                {f.required && <span className="text-indigo-600"> *</span>}
              </span>
              {f.area ? (
                <textarea
                  value={form[f.k] || ""}
                  onChange={(e) => set(f.k, e.target.value)}
                  placeholder={f.ph}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <input
                  value={form[f.k] || ""}
                  onChange={(e) => set(f.k, e.target.value)}
                  placeholder={f.ph}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </label>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="mt-2 rounded-xl bg-indigo-600 text-white font-semibold py-2.5 hover:bg-indigo-700 transition-colors"
          >
            Generate pitch
          </button>
          <p className="text-xs text-slate-400">Copy is free (subscription). The concept video (~6 credits) is a separate click.</p>
        </form>
      )}

      {phase === "working" && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="text-lg font-semibold">Qualifying your prospect…</div>
          <p className="text-slate-500 mt-1 text-sm">
            Classifying → extracting → verifying → legal check → writing copy. This runs on your subscription and
            usually takes a minute or two.
          </p>
          <div className="mt-4 inline-block h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
          </div>
        </div>
      )}

      {phase === "done" && lead && (
        <div className="mt-6 space-y-4">
          {/* verdict banner */}
          {lead.status === "QUALIFIED" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="font-bold text-emerald-800">✓ Qualified</div>
              <p className="text-sm text-emerald-700 mt-0.5">
                Verified and legally clear. Sample ad copy is ready below.
              </p>
            </div>
          )}
          {lead.status === "NEEDS_INFO" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-bold text-amber-800">Needs more info</div>
              <p className="text-sm text-amber-700 mt-0.5">
                Missing: {(v?.missing || []).join(", ") || "key details"}. Add them and try again.
              </p>
            </div>
          )}
          {lead.status === "REJECTED" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="font-bold text-red-800">Stopped at legal check</div>
              <p className="text-sm text-red-700 mt-0.5">{(v?.legal_issues || []).join("; ") || "Claim risk detected."}</p>
            </div>
          )}
          {["ERROR", "PENDING", "PROCESSING"].includes(lead.status) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="font-bold text-slate-700">Still working / no result yet</div>
              <p className="text-sm text-slate-500 mt-0.5">Give the runner a moment, then check the Leads pipeline.</p>
            </div>
          )}

          {/* verification detail */}
          {v?.extracted && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">What we understood</div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div><span className="text-slate-400">Company:</span> {v.extracted.company_name || "—"}</div>
                <div><span className="text-slate-400">Niche:</span> {v.extracted.niche || "—"}</div>
                <div><span className="text-slate-400">Metro:</span> {v.extracted.metro_area || "—"}</div>
                <div><span className="text-slate-400">Legal:</span> {v.legal_safe ? "clear" : "flagged"}</div>
              </div>
            </div>
          )}

          {/* sample copy */}
          {campaign && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sample ad copy</div>
              <div className="mt-2 font-semibold">{campaign.subject}</div>
              <div
                className="mt-2 text-sm text-slate-600 prose-sm"
                dangerouslySetInnerHTML={{ __html: campaign.template_html }}
              />
            </div>
          )}

          {/* video CTA + actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center gap-3">
            {project && (
              <Link
                href={`/dashboard/projects/${project.id}/assets`}
                className="rounded-xl bg-indigo-600 text-white font-semibold px-4 py-2.5 text-sm hover:bg-indigo-700 transition-colors"
              >
                Render concept video (~6 credits) →
              </Link>
            )}
            <Link href="/dashboard/leads" className="text-sm font-medium text-indigo-600 hover:underline">
              View in pipeline
            </Link>
            <button onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-800 ml-auto">
              New pitch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
