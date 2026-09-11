"use client";

import { useEffect, useState } from "react";

type Campaign = { id: string; name: string; subject: string; template_html: string; status: string };
type Asset = { id: string; name: string; url: string | null; status: string; metadata: Record<string, unknown> | null };
type Project = { id: string; name: string; email_campaigns: Campaign[]; assets: Asset[] };
type ClientProfile = {
  id: string;
  company_name: string;
  metro_area: string;
  phone: string | null;
  niche: string;
  project: Project | null;
} | null;
type Lead = {
  id: string;
  email: string;
  intent_status: string;
  status: string;
  verification: Record<string, unknown> | null;
  created_at: string | null;
  client_profile: ClientProfile;
};

/** Map a lead status to a verification badge. */
function badge(status: string): { label: string; cls: string } {
  switch (status) {
    case "QUALIFIED":
      return { label: "VERIFIED", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "REJECTED":
    case "ERROR":
      return { label: "REJECTED", cls: "bg-rose-100 text-rose-700 border-rose-200" };
    default:
      return { label: "PENDING REVIEW", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leads.");
      setLeads(data.leads ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function approve(lead: Lead) {
    const camp = lead.client_profile?.project?.email_campaigns?.[0];
    const ok = window.confirm(
      `Approve & deliver for ${lead.client_profile?.company_name ?? lead.email}?\n\n` +
        `Outgoing email: ${camp?.subject ?? "(sample copy)"}\n` +
        `A generated concept video preview is attached where available.\n\n` +
        `This marks the campaign READY_FOR_DELIVERY.`,
    );
    if (!ok) return;
    setBusy(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Leads / Pipeline</h1>
      <p className="mt-2 text-slate-500">
        Inbound prospects, autonomously qualified — verified business details, sample ad copy, and a
        generated concept video. Approve to mark the campaign ready for delivery.
      </p>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      {loading && <p className="mt-6 text-slate-400">Loading…</p>}
      {!loading && leads.length === 0 && (
        <p className="mt-10 text-slate-400">No leads yet. Inbound replies land here once the webhook fires.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {leads.map((lead) => {
          const b = badge(lead.status);
          const profile = lead.client_profile;
          const camp = profile?.project?.email_campaigns?.[0];
          const video = profile?.project?.assets?.find((a) => a.url) ?? profile?.project?.assets?.[0];
          const canApprove = lead.status === "QUALIFIED";
          return (
            <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {profile?.company_name ?? lead.email}
                  </div>
                  <div className="text-sm text-slate-500">
                    {lead.email}
                    {profile && (
                      <>
                        {" · "}
                        {profile.metro_area}
                        {" · "}
                        {profile.niche}
                        {profile.phone ? ` · ${profile.phone}` : ""}
                      </>
                    )}
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.cls}`}>{b.label}</span>
              </div>

              {Array.isArray(lead.verification?.legal_issues) &&
                (lead.verification!.legal_issues as string[]).length > 0 && (
                  <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    Legal flags: {(lead.verification!.legal_issues as string[]).join("; ")}
                  </p>
                )}
              {Array.isArray(lead.verification?.missing) &&
                (lead.verification!.missing as string[]).length > 0 && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Needs info: {(lead.verification!.missing as string[]).join(", ")}
                  </p>
                )}

              {(camp || video) && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {camp && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Sample email
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">{camp.subject}</div>
                      <div
                        className="prose prose-sm mt-2 max-h-40 overflow-y-auto text-sm text-slate-600"
                        dangerouslySetInnerHTML={{ __html: camp.template_html }}
                      />
                      <div className="mt-2 text-xs text-slate-400">status: {camp.status}</div>
                    </div>
                  )}
                  {video && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Concept video
                      </div>
                      {video.url ? (
                        <video src={video.url} controls className="mt-2 w-full rounded" />
                      ) : (
                        <div className="mt-2 text-sm text-slate-500">
                          {video.metadata && (video.metadata as { budgetCapExceeded?: boolean }).budgetCapExceeded
                            ? "Draft copy only — 200-credit cap reached."
                            : `Generating… (${video.status})`}
                        </div>
                      )}
                      {video.metadata && typeof (video.metadata as { hook?: string }).hook === "string" && (
                        <div className="mt-2 text-xs text-slate-500">
                          Hook: {(video.metadata as { hook: string }).hook}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => approve(lead)}
                  disabled={!canApprove || busy === lead.id}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === lead.id ? "Approving…" : "1-Click Approve & Deliver"}
                </button>
                <span className="text-xs text-slate-400">intent: {lead.intent_status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
