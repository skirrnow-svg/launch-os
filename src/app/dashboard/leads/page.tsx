"use client";

import { useEffect, useState } from "react";
import VideoPromptBuilder from "@/components/leads/VideoPromptBuilder";

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
  const [addendum, setAddendum] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null);
  const [isPaid, setIsPaid] = useState(false);

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
    // Resolve the workspace plan so the builder knows whether generation is unlocked.
    fetch("/api/org")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsPaid(Boolean(d?.plan?.isPaid)))
      .catch(() => setIsPaid(false));
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

  async function deliver(lead: Lead) {
    const camp = lead.client_profile?.project?.email_campaigns?.[0];
    const ok = window.confirm(
      `Send the approved email to ${lead.email}?\n\n` +
        `Subject: ${camp?.subject ?? "(sample copy)"}\n\n` +
        `This actually emails the prospect via Resend.`,
    );
    if (!ok) return;
    setBusy(lead.id);
    setError("");
    try {
      const res = await fetch(`/api/leads/${lead.id}/deliver`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy("");
    }
  }

  // Re-run a NEEDS_INFO lead after adding detail, and/or override the AI's soft
  // checks ("approve anyway"). It goes back through qualification → samples.
  async function requeue(lead: Lead, force: boolean) {
    const text = (addendum[lead.id] ?? "").trim();
    if (!text && !force) {
      setError("Add some detail, or use “Approve anyway”.");
      return;
    }
    if (
      force &&
      !window.confirm(
        `Approve anyway for ${lead.email}?\n\nThis overrides the AI's business/location flag and re-runs qualification. It still passes legal review before the sample ad is generated.`,
      )
    ) {
      return;
    }
    setBusy(lead.id);
    setError("");
    try {
      const res = await fetch(`/api/leads/${lead.id}/requeue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addendum: text, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Re-run failed.");
      setAddendum((a) => ({ ...a, [lead.id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-run failed.");
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

      <VideoPromptBuilder isPaid={isPaid} />

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
          const canSend = camp?.status === "ready_for_delivery";
          const isSent = camp?.status === "sent";
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
              {(() => {
                const reasons = Array.isArray(lead.verification?.needs_info_reason)
                  ? (lead.verification!.needs_info_reason as string[])
                  : Array.isArray(lead.verification?.missing)
                    ? (lead.verification!.missing as string[])
                    : [];
                if (lead.status !== "NEEDS_INFO" || reasons.length === 0) return null;
                return (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="font-semibold">To move this forward, we need:</span>
                    <ul className="mt-1 list-disc pl-4">
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <span className="mt-1 block text-amber-600">A clarification email draft is waiting in the “Intake” project.</span>
                  </div>
                );
              })()}

              {lead.status === "NEEDS_INFO" && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Add the missing detail, then re-run
                  </label>
                  <textarea
                    value={addendum[lead.id] ?? ""}
                    onChange={(e) => setAddendum((a) => ({ ...a, [lead.id]: e.target.value }))}
                    rows={2}
                    placeholder="e.g. City: Pune, Maharashtra · Contact: +91… / name@brand.com · Offer: premium adventure-touring riding boots, waterproof, CE-certified"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => requeue(lead, false)}
                      disabled={busy === lead.id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {busy === lead.id ? "Re-running…" : "Add details & re-run"}
                    </button>
                    <button
                      onClick={() => requeue(lead, true)}
                      disabled={busy === lead.id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      title="Override the AI's business/location flag and push it through (still passes legal review)"
                    >
                      Approve anyway
                    </button>
                    <span className="text-[11px] text-slate-400">Re-runs qualification → generates the sample ad.</span>
                  </div>
                </div>
              )}

              {(camp || video) && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {camp && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Sample email — the ad copy that will be sent
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">{camp.subject}</div>
                      {/* Sandboxed: generated HTML renders isolated; sandbox="" blocks any scripts. */}
                      <iframe
                        title={`Email preview — ${camp.subject}`}
                        srcDoc={camp.template_html}
                        sandbox=""
                        className="mt-2 h-48 w-full rounded border border-slate-200 bg-white"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-slate-400">status: {camp.status}</span>
                        <button
                          onClick={() => setPreview({ title: camp.subject, html: camp.template_html })}
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          Preview full email →
                        </button>
                      </div>
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
                  disabled={!canApprove || canSend || isSent || busy === lead.id}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {canSend || isSent ? "Approved ✓" : busy === lead.id ? "Approving…" : "1-Click Approve"}
                </button>
                {(canSend || isSent) && !isSent && camp && (
                  <button
                    onClick={() => setPreview({ title: camp.subject, html: camp.template_html })}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    Preview before sending
                  </button>
                )}
                {(canSend || isSent) && (
                  <button
                    onClick={() => deliver(lead)}
                    disabled={isSent || busy === lead.id}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSent ? "Sent ✓" : busy === lead.id ? "Sending…" : "Send to prospect →"}
                  </button>
                )}
                <span className="text-xs text-slate-400">intent: {lead.intent_status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-email preview modal — review the exact copy before it is sent. */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <span className="truncate text-sm font-medium text-slate-800">{preview.title}</span>
              <button
                onClick={() => setPreview(null)}
                className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close ✕
              </button>
            </div>
            <iframe
              title={preview.title}
              srcDoc={preview.html}
              sandbox=""
              className="h-full w-full flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
