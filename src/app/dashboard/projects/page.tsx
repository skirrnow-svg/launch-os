"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  created_at: string | null;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load projects.");
      setProjects(data.projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create project.");
      setName("");
      setDescription("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Projects</h1>
      <p className="text-slate-500 mt-1">Each project is a launch you orchestrate.</p>

      <form onSubmit={create} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-3">
        <div className="grid gap-1">
          <label htmlFor="name" className="text-sm font-semibold">Project name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring product launch"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="description" className="text-sm font-semibold">Description <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you launching?"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="justify-self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create project"}
        </button>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>

      <div className="mt-8">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-slate-500 text-sm">No projects yet — create your first one above.</p>
        ) : (
          <ul className="grid gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-400 transition-colors"
                >
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    {p.description && <div className="text-sm text-slate-500">{p.description}</div>}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1">
                    {p.status}
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
