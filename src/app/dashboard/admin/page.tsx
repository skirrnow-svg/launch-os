"use client";

import { FormEvent, useEffect, useState } from "react";

/**
 * Admin → Integration settings.
 * Org-scoped page to view/update the integration API keys the platform uses for
 * AI orchestration and asset generation. Keys are write-only from the UI (shown
 * masked, never returned in full) and persisted encrypted server-side via
 * PATCH /api/admin/settings. Current state (set? from org or env?) loads on mount.
 *
 * TODO(phase-1+): gate behind an admin role check once Clerk org roles are wired.
 */

type KeyField = { name: string; label: string; placeholder: string; help: string };

const FIELDS: KeyField[] = [
  { name: "CLAUDE_API_KEY", label: "AI copy key", placeholder: "…", help: "AI orchestration (asset briefs, copy, prompts)." },
  { name: "HIGGSFIELD_API_KEY", label: "Media generation key", placeholder: "…", help: "Image/video generation. Budget-capped — see generation guardrails." },
];

type Setting = { set: boolean; masked: string | null; source: "org" | "env" | null };

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<Record<string, Setting>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (res.ok) setCurrent(data.settings ?? {});
    } catch {
      /* non-fatal: form still works */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");
    const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save settings.");
      setStatus("saved");
      setMessage("Saved. New keys take effect on the next request.");
      setValues({});
      load();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="max-w-xl">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Admin</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900">Integration settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Update the API keys Launch OS uses for AI generation. Keys are stored encrypted and never
        shown again once saved.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-5 rounded border border-slate-200 bg-white p-6">
        {FIELDS.map((f) => {
          const c = current[f.name];
          return (
            <label key={f.name} className="grid gap-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {f.label}
                {c?.set ? (
                  <span className="text-xs font-medium text-success">
                    ✓ {c.masked}
                    {c.source === "env" ? " (from server env)" : " (saved)"}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">not set</span>
                )}
              </span>
              <input
                type="password"
                autoComplete="off"
                placeholder={c?.set ? "Enter a new value to replace" : f.placeholder}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="rounded border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-xs text-slate-400">{f.help}</span>
            </label>
          );
        })}
        <button
          type="submit"
          disabled={status === "saving"}
          className="justify-self-start rounded bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save keys"}
        </button>
        {message && (
          <p role="status" className={`text-sm ${status === "error" ? "text-danger" : "text-success"}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
