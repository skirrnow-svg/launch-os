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
  { name: "CLAUDE_API_KEY", label: "Claude API key", placeholder: "sk-ant-…", help: "AI orchestration (asset briefs, copy, prompts)." },
  { name: "HIGGSFIELD_API_KEY", label: "Higgsfield API key", placeholder: "…", help: "Image/video generation. Budget-capped — see Higgsfield guardrails." },
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
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Integration settings</h1>
      <p style={{ color: "#64748b", marginBottom: 28 }}>
        Admin only. Update the API keys Launch OS uses for AI generation. Keys are stored
        encrypted and never shown again once saved.
      </p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 20 }}>
        {FIELDS.map((f) => {
          const c = current[f.name];
          return (
            <label key={f.name} style={{ display: "grid", gap: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                {f.label}
                {c?.set ? (
                  <span style={{ fontWeight: 500, fontSize: 12, color: "#16a34a" }}>
                    ✓ {c.masked}
                    {c.source === "env" ? " (from server env)" : " (saved)"}
                  </span>
                ) : (
                  <span style={{ fontWeight: 500, fontSize: 12, color: "#94a3b8" }}>not set</span>
                )}
              </span>
              <input
                type="password"
                autoComplete="off"
                placeholder={c?.set ? "Enter a new value to replace" : f.placeholder}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, font: "inherit" }}
              />
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{f.help}</span>
            </label>
          );
        })}
        <button
          type="submit"
          disabled={status === "saving"}
          style={{ justifySelf: "start", padding: "10px 18px", borderRadius: 8, border: 0, background: "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          {status === "saving" ? "Saving…" : "Save keys"}
        </button>
        {message && (
          <p role="status" style={{ color: status === "error" ? "#dc2626" : "#16a34a", fontSize: 14 }}>
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
