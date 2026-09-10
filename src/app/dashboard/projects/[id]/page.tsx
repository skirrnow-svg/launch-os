"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  slug: string;
  created_at: string | null;
};

const STATUSES = ["draft", "active", "launched", "archived"];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Project not found.");
        if (!active) return;
        setProject(data.project);
        setName(data.project.name);
        setStatus(data.project.status);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Project not found.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setProject(data.project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/projects");
    else setError("Could not delete.");
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading…</p>;
  if (!project) return <p className="text-red-600 text-sm">{error || "Not found."}</p>;

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/projects" className="text-sm text-indigo-600 hover:underline">← Projects</Link>
      <h1 className="text-2xl font-extrabold tracking-tight mt-3">{project.name}</h1>
      <p className="text-slate-400 text-xs mt-1 font-mono">{project.slug}</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-4">
        <div className="grid gap-1">
          <label htmlFor="pname" className="text-sm font-semibold">Name</label>
          <input
            id="pname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="pstatus" className="text-sm font-semibold">Status</label>
          <select
            id="pstatus"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={remove}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
    </div>
  );
}
