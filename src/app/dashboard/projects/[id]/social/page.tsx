"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Post = {
  id: string;
  content: string;
  platforms: string[];
  status: string;
  created_at: string | null;
};

const PLATFORMS = ["twitter", "linkedin", "instagram", "facebook"];

export default function ProjectSocialPage() {
  const { id } = useParams<{ id: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["twitter"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/social`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load posts.");
      setPosts(data.posts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function togglePlatform(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create post.");
      setContent("");
      setPlatforms(["twitter"]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create post.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/dashboard/projects/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Project
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight mt-3">Social posts</h1>
      <p className="text-slate-500 mt-1">
        Create a post, then click it to write the copy with AI, pick platforms and hashtags.
        Scheduling via Buffer comes in Phase 2.
      </p>

      <form onSubmit={create} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-3">
        <div className="grid gap-1">
          <label htmlFor="content" className="text-sm font-semibold">Post content</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to announce?"
            rows={3}
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
                  onClick={() => togglePlatform(p)}
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
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="justify-self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create post"}
        </button>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>

      <div className="mt-8">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-slate-500 text-sm">No posts yet.</p>
        ) : (
          <ul className="grid gap-2">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/dashboard/projects/${id}/social/${post.id}`}
                  className="block rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-400 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1 shrink-0">
                      {post.status}
                    </span>
                  </div>
                  {post.platforms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {post.platforms.map((p) => (
                        <span key={p} className="text-xs text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
