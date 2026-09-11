"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Asset = {
  id: string;
  type: string;
  name: string;
  prompt: string | null;
  description: string | null;
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
  const [withAI, setWithAI] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const NOTICES: Record<string, string> = {
    ready: "Generated. The result is saved on the asset.",
    "prompt-ready": "Prompt refined and saved. Media generation isn't wired to the provider yet.",
    "confirmation-required": "Refined prompt saved. Media needs cost confirmation before it runs.",
    "not-configured": "Saved as draft — add the API key in Admin to generate.",
    "needs-prompt": "Saved as draft — add a prompt to generate.",
    draft: "Saved as a draft.",
    error: "Saved, but generation hit an error.",
  };

  const [busyId, setBusyId] = useState<string | null>(null);

  async function generateMedia(assetId: string) {
    setBusyId(assetId);
    setError("");
    setNotice("");
    try {
      // 1) price the job (no spend)
      const priceRes = await fetch(`/api/projects/${id}/assets/${assetId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const price = await priceRes.json();
      if (price.status === "not-configured") {
        setNotice(price.message || "Higgsfield is not configured on the host.");
        return;
      }
      if (price.status !== "confirmation-required") {
        setNotice(price.message || "Could not price the generation.");
        return;
      }
      // 2) explicit human confirmation of the credit cost
      const ok = window.confirm(
        `This will generate media via Higgsfield (${price.model}) and cost ~${price.estimatedCredits} credits.\n\nProceed?`,
      );
      if (!ok) {
        setNotice("Generation cancelled — no credits spent.");
        return;
      }
      // 3) confirmed spend
      const genRes = await fetch(`/api/projects/${id}/assets/${assetId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const gen = await genRes.json();
      if (gen.status === "ready") {
        setNotice(`Generated (${gen.model}, ${gen.creditsUsed} credits).`);
        await load();
      } else if (gen.status === "queued") {
        setNotice("Queued — the runner is generating this. Refresh in a moment to see the result.");
        await load();
      } else {
        setNotice(gen.message || "Generation did not complete.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/projects/${id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, prompt, generate: withAI }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create asset.");
      const base = NOTICES[data.generation as string] ?? "Saved.";
      setNotice(
        data.generation === "confirmation-required" && data.estimatedCredits
          ? `${base} (~${data.estimatedCredits} credits)`
          : data.message
            ? `${base} ${data.message}`
            : base,
      );
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
        AI-generated marketing assets for this launch. Copy is written by Claude and media by
        Higgsfield — both via your Claude Code + Higgsfield subscriptions, no API keys needed.
        Image/video generation always shows its credit cost and asks before spending.
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
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={withAI} onChange={(e) => setWithAI(e.target.checked)} />
          Generate with AI (uses this org&apos;s API keys)
        </label>
        <button
          type="submit"
          disabled={saving}
          className="justify-self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? (withAI ? "Generating…" : "Saving…") : withAI ? "Generate asset" : "Save draft"}
        </button>
        {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
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
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
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
                </div>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
                    View generated file →
                  </a>
                ) : a.description ? (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap border-t border-slate-100 pt-2">
                    {a.description}
                  </p>
                ) : null}
                {(a.type === "image" || a.type === "video") && a.prompt && !a.url && (
                  <button
                    onClick={() => generateMedia(a.id)}
                    disabled={busyId === a.id}
                    className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {busyId === a.id ? "Generating…" : "Generate media (shows cost first)"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
