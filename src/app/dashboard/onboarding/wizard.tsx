"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Two-step first-run wizard:
 *  1. Name your workspace (renames the active org).
 *  2. Create your first project → lands on that project.
 * "Skip for now" sets a cookie so the dashboard stops redirecting here.
 */

const ONBOARDED_COOKIE = "lo_onboarded=1; path=/; max-age=31536000; samesite=lax";

export default function OnboardingWizard({ initialOrgName }: { initialOrgName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [workspace, setWorkspace] = useState(initialOrgName);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function markOnboarded() {
    try {
      document.cookie = ONBOARDED_COOKIE;
    } catch {
      /* ignore */
    }
  }

  async function saveWorkspace() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspace }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save workspace name.");
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create project.");
      markOnboarded();
      router.push(`/dashboard/projects/${data.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  function skip() {
    markOnboarded();
    router.push("/dashboard");
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <span className={step === 1 ? "text-indigo-600" : ""}>1 · Workspace</span>
        <span>›</span>
        <span className={step === 2 ? "text-indigo-600" : ""}>2 · First project</span>
      </div>

      {step === 1 ? (
        <div className="mt-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome to Launch OS</h1>
          <p className="text-slate-500 mt-1">Let&apos;s set up your workspace. You can change this anytime.</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-4">
            <div className="grid gap-1">
              <label htmlFor="ws" className="text-sm font-semibold">Workspace name</label>
              <input
                id="ws"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="Acme Launches"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveWorkspace}
                disabled={busy || !workspace.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue"}
              </button>
              <button onClick={skip} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                Skip for now
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Create your first launch</h1>
          <p className="text-slate-500 mt-1">A project holds the assets, emails, and social posts for one launch.</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 grid gap-4">
            <div className="grid gap-1">
              <label htmlFor="pj" className="text-sm font-semibold">Project name</label>
              <input
                id="pj"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Spring Product Launch"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={createProject}
                disabled={busy || !projectName.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create project"}
              </button>
              <button onClick={() => setStep(1)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                Back
              </button>
              <button onClick={skip} className="text-sm font-semibold text-slate-400 hover:text-slate-600">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
