"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  template_html: string;
  status: string;
  from_name: string;
  from_email: string;
};

export default function CampaignDetailPage() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const [c, setC] = useState<Campaign | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/projects/${id}/emails/${campaignId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found.");
      setC(data.campaign);
      setSubject(data.campaign.subject);
      setHtml(data.campaign.template_html);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not found.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, campaignId]);

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${id}/emails/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data as { campaign: Campaign; generation?: string };
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await patch({ subject, template_html: html });
      setC(data.campaign);
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const data = await patch({ generate: true, brief });
      if (data.generation === "not-configured") {
        setNotice("Claude CLI isn't reachable on the host — can't generate copy right now.");
      } else if (data.generation === "error") {
        setNotice("Generation failed — try again.");
      } else {
        setC(data.campaign);
        setSubject(data.campaign.subject);
        setHtml(data.campaign.template_html);
        setNotice("Draft written by Claude. Review and save.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading…</p>;
  if (!c) return <p className="text-red-600 text-sm">{error || "Not found."}</p>;

  return (
    <div className="max-w-3xl">
      <Link href={`/dashboard/projects/${id}/emails`} className="text-sm text-indigo-600 hover:underline">
        ← Campaigns
      </Link>
      <div className="flex items-center gap-3 mt-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{c.name}</h1>
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1">
          {c.status}
        </span>
      </div>
      <p className="text-slate-400 text-xs mt-1">From {c.from_name} · {c.from_email}</p>

      {/* AI copy */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-3">
        <div className="font-semibold text-sm">Generate with AI</div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Brief: what's the launch, audience, tone, key call-to-action…"
          rows={2}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y"
        />
        <button
          onClick={generate}
          disabled={generating}
          className="justify-self-start rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {generating ? "Writing…" : "Write subject + body with Claude"}
        </button>
      </div>

      {/* Editor */}
      <form onSubmit={save} className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 grid gap-4">
        <div className="grid gap-1">
          <label htmlFor="subject" className="text-sm font-semibold">Subject</label>
          <input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="html" className="text-sm font-semibold">Email body (HTML)</label>
          <textarea
            id="html"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={10}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono resize-y"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <span className="text-xs text-slate-400">Sending via Resend arrives in Phase 3.</span>
        </div>
        {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>

      {/* Preview */}
      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">Preview</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500 mb-3 border-b border-slate-100 pb-2">
            <span className="font-semibold text-slate-700">{subject || "(no subject)"}</span>
          </div>
          <div
            className="prose prose-sm max-w-none"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
