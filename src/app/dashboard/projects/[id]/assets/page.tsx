"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Asset = {
  id: string;
  type: string;
  name: string;
  prompt: string | null;
  status: string;
  url: string | null;
  created_at: string | null;
};

const TYPES = ["image", "video", "email", "social"];

export default function ProjectAssetsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [type, setType] = useState("image");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/assets`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load assets.");
      setAssets(data.assets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create asset.");
      setName("");
      setPrompt("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create asset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/dashboard/projects/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Project
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight mt-3">Assets</h1>
      <p className="text-slate-500 mt-1">
        AI-generated marketing assets for this launch.{" "}
        <span className="text-amber-600">Generation is stubbed until API keys are configured</span> —
        requests are saved as drafts.
      </p>

      <form onSubmit={generate} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-3">
        <div className="grid grid-cols-[140px_1fr] gap-3">
          <div className="grid gap-1">
            <label htmlFor="type" className="text-sm font-semibold">Type</label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="aname" className="text-sm font-semibold">Name</label>
            <input
              id="aname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hero banner"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-1">
          <label htmlFor="prompt" className="text-sm font-semibold">Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the asset you want to generate…"
            rows={3}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="justify-self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Request asset"}
        </button>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>

      <div className="mt-8">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="text-slate-500 text-sm">No assets yet — request your first one above.</p>
        ) : (
          <ul className="grid gap-2">
            {assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.name}</div>
                  {a.prompt && <div className="text-sm text-slate-500 truncate">{a.prompt}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 border border-slate-200 rounded-full px-2.5 py-1">
                    {a.type}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1">
                    {a.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
