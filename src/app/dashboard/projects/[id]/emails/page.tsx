"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  emails_sent: number | null;
  created_at: string | null;
};

export default function ProjectEmailsPage() {
  const { id } = useParams<{ id: string }>();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/emails`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load campaigns.");
      setCampaigns(data.campaigns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create campaign.");
      setName("");
      setSubject("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/dashboard/projects/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Project
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight mt-3">Email campaigns</h1>
      <p className="text-slate-500 mt-1">
        Create a campaign, then click it to write the copy with AI and edit the body.
        Sending via Resend comes in Phase 3.
      </p>

      <form onSubmit={create} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-3">
        <div className="grid gap-1">
          <label htmlFor="cname" className="text-sm font-semibold">Campaign name</label>
          <input
            id="cname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Launch announcement"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="subject" className="text-sm font-semibold">
            Subject <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="We're live 🚀"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="justify-self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create campaign"}
        </button>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>

      <div className="mt-8">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-slate-500 text-sm">No campaigns yet.</p>
        ) : (
          <ul className="grid gap-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/projects/${id}/emails/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-400 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-sm text-slate-500 truncate">{c.subject}</div>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1 shrink-0">
                    {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
