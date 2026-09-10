"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Post = {
  id: string;
  content: string;
  platforms: string[];
  hashtags: string[];
  status: string;
};

const PLATFORMS = ["twitter", "linkedin", "instagram", "facebook"];

export default function SocialPostDetailPage() {
  const { id, postId } = useParams<{ id: string; postId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState("");
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function hydrate(p: Post) {
    setPost(p);
    setContent(p.content);
    setPlatforms(p.platforms);
    setHashtags((p.hashtags ?? []).join(" "));
  }

  async function load() {
    try {
      const res = await fetch(`/api/projects/${id}/social/${postId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found.");
      hydrate(data.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not found.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, postId]);

  function toggle(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${id}/social/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data as { post: Post; generation?: string };
  }

  const hashtagList = () =>
    hashtags.split(/[\s,]+/).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await patch({ content, platforms, hashtags: hashtagList() });
      hydrate(data.post);
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
      const data = await patch({ generate: true, brief, platforms });
      if (data.generation === "not-configured") {
        setNotice("Add a CLAUDE_API_KEY in Admin to generate copy.");
      } else if (data.generation === "error") {
        setNotice("Generation failed — try again.");
      } else {
        hydrate(data.post);
        setNotice("Draft written by Claude. Review and save.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading…</p>;
  if (!post) return <p className="text-red-600 text-sm">{error || "Not found."}</p>;

  const preview = [content, hashtagList().map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");

  return (
    <div className="max-w-3xl">
      <Link href={`/dashboard/projects/${id}/social`} className="text-sm text-indigo-600 hover:underline">
        ← Social posts
      </Link>
      <div className="flex items-center gap-3 mt-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit post</h1>
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1">
          {post.status}
        </span>
      </div>

      {/* AI copy */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-3">
        <div className="font-semibold text-sm">Generate with AI</div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Brief: what to announce, angle, tone. Leave blank to rewrite the current copy."
          rows={2}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y"
        />
        <button
          onClick={generate}
          disabled={generating}
          className="justify-self-start rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {generating ? "Writing…" : "Write copy with Claude"}
        </button>
      </div>

      {/* Editor */}
      <form onSubmit={save} className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 grid gap-4">
        <div className="grid gap-1">
          <label htmlFor="content" className="text-sm font-semibold">Content</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-sm font-semibold">Platforms</span>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggle(p)}
                  className={`rounded-full px-3 py-1 text-sm font-medium border ${
                    on
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-1">
          <label htmlFor="tags" className="text-sm font-semibold">
            Hashtags <span className="font-normal text-slate-400">(space-separated)</span>
          </label>
          <input
            id="tags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="launch product ai"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
          <span className="text-xs text-slate-400">Scheduling via Buffer arrives in Phase 2.</span>
        </div>
        {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>

      {/* Preview */}
      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">Preview</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm whitespace-pre-wrap">{preview || "(empty)"}</p>
        </div>
      </div>
    </div>
  );
}
