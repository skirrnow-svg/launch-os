"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * Universal AI Video Prompt Builder (see Instructions/videogenpromptgen.txt).
 *
 * A guided form that assembles non-technical inputs into a clean, physically
 * accurate commercial video prompt in real time, and injects a fixed,
 * production-ready negative prompt on output.
 *
 * Access model:
 *  - Visible to any signed-in (verified) user — building and copying a prompt is
 *    always available.
 *  - "Generate Video" is enabled only for PAID users (isPaid). Free users see an
 *    upgrade affordance instead; they can still copy the prompt.
 */

// Fixed negative prompt — mirrors the server; shown read-only, never editable.
const FIXED_NEGATIVE =
  "text, typography, misspelled words, floating logos, watermark, morphing fingers, " +
  "extra limbs, disjointed joints, unrealistic physics, zero compression, rubbery movement, " +
  "blur, low quality";

const HERO_SUGGESTIONS = [
  "Waterproof adventure boots",
  "SaaS dashboard",
  "Premium wireless earbuds",
  "Electric SUV",
  "Skincare serum bottle",
];

const ACTORS = [
  "No people (product only)",
  "Motorcycle rider in technical gear",
  "Software engineer at a desk",
  "Athlete mid-training",
  "Chef in a professional kitchen",
  "Field technician on-site",
  "Everyday commuter",
];

const CAMERAS = [
  "Low-angle three-quarter tracking",
  "Macro close-up with shallow depth of field",
  "Smooth dolly-in",
  "Slow 180-degree orbit",
  "Eye-level static hero shot",
  "Overhead top-down reveal",
  "Handheld follow",
];

const ENVIRONMENTS = [
  "Wet coastal asphalt at sunrise",
  "Minimalist studio rim lighting",
  "Neon-lit city street at night",
  "Sunlit modern office",
  "Rugged mountain trail at golden hour",
  "Clean white cyclorama",
];

const MATERIALS = [
  "Matte rubber & reinforced armor",
  "Brushed metal",
  "Crisp screen luminance",
  "Full-grain leather",
  "Carbon fibre weave",
  "Water droplets & mist",
  "Anodized aluminium",
  "Soft fabric texture",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300";

export default function VideoPromptBuilder({ isPaid }: { isPaid: boolean }) {
  const [open, setOpen] = useState(false);
  const [hero, setHero] = useState("");
  const [actor, setActor] = useState(ACTORS[0]);
  const [action, setAction] = useState("");
  const [camera, setCamera] = useState(CAMERAS[0]);
  const [environment, setEnvironment] = useState(ENVIRONMENTS[0]);
  const [materials, setMaterials] = useState<string[]>([]);
  // Production guardrails — default checked.
  const [gravity, setGravity] = useState(true);
  const [noText, setNoText] = useState(true);
  const [noMorph, setNoMorph] = useState(true);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function toggleMaterial(m: string) {
    setMaterials((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  // Compile the structured state into a single positive prompt. Unset fields are
  // dropped gracefully and redundant whitespace collapsed.
  const positive = useMemo(() => {
    const h = hero.trim();
    if (!h) return "";
    const parts: string[] = [];
    parts.push(`${camera} focused on ${h}`);
    if (actor && actor !== ACTORS[0]) parts.push(`used by ${actor}`);
    if (environment) parts.push(`in ${environment}`);
    let sentence = parts.join(" ") + ".";

    sentence += action.trim()
      ? ` Action: ${action.trim()}, demonstrating authentic weight and fluid dynamics.`
      : " Demonstrating authentic weight and fluid dynamics.";

    if (materials.length) {
      sentence += ` Material focus: ${materials.join(", ")} highlighted with crisp commercial lighting and sharp edge contrast.`;
    }

    // Guardrails reinforce the positive side (the negative prompt is fixed below).
    if (gravity) sentence += " Strict physical gravity, weight transfer and realistic suspension compression.";
    if (noMorph) sentence += " Anatomically correct limbs and joints throughout, no morphing.";
    if (noText) sentence += " No on-screen text, typography or floating badges.";

    sentence +=
      " Photorealistic, cinematic 24fps, high fidelity, clean footage, zero on-screen text, no overlays.";

    return sentence.replace(/\s+/g, " ").trim();
  }, [hero, actor, action, camera, environment, materials, gravity, noText, noMorph]);

  const canBuild = positive.length > 0;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(positive);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy — select the text and copy manually.");
    }
  }

  async function generate() {
    if (!isPaid) return;
    setError("");
    setNotice("");
    // Confirm-before-spend: ask the server for the cost, then confirm.
    setBusy(true);
    try {
      const pre = await fetch("/api/leads/video/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positive }),
      });
      const est = await pre.json();
      if (pre.status === 402) {
        setError(est.error || "This is a paid feature.");
        return;
      }
      if (!pre.ok) throw new Error(est.error || "Could not start generation.");
      if (est.status !== "confirmation-required") throw new Error("Unexpected response.");

      const ok = window.confirm(
        `Generate this video now?\n\nEstimated cost: ~${est.estimatedCredits} Higgsfield credits (${est.model}).\nIt renders in the background and appears in your Video Studio project.`,
      );
      if (!ok) return;

      const res = await fetch("/api/leads/video/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positive, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start generation.");
      if (data.status === "budget-exceeded") {
        setError(data.message || "Monthly credit pool is exhausted.");
        return;
      }
      if (data.status === "queued") {
        setNotice(
          `Queued (~${data.estimatedCredits} credits). It is rendering in the background — track it in your Video Studio project.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start generation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-indigo-900">AI Video Prompt Builder</span>
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {isPaid ? "Pro" : "Preview"}
          </span>
        </span>
        <span className="text-xs font-semibold text-indigo-600">{open ? "Hide −" : "Open +"}</span>
      </button>

      {open && (
        <div className="border-t border-indigo-200 p-5">
          <p className="mb-4 text-xs text-slate-600">
            Answer a few questions and we assemble a clean, physically accurate commercial video
            prompt for you — with a production-grade safety filter baked in. Copy it anywhere, or
            generate the video directly.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Hero subject — the product or UI">
              <input
                list="hero-suggestions"
                value={hero}
                onChange={(e) => setHero(e.target.value)}
                placeholder="e.g. Waterproof adventure boots"
                className={inputCls}
              />
              <datalist id="hero-suggestions">
                {HERO_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>

            <Field label="Actor / context">
              <select value={actor} onChange={(e) => setActor(e.target.value)} className={inputCls}>
                {ACTORS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Camera framing & movement">
              <select value={camera} onChange={(e) => setCamera(e.target.value)} className={inputCls}>
                {CAMERAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Environment & lighting">
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className={inputCls}
              >
                {ENVIRONMENTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Core action & interaction — the exact mechanical movement">
                <textarea
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  rows={2}
                  placeholder="e.g. Stepping onto the footpeg with realistic suspension compression, then swinging a leg over the saddle"
                  className={`${inputCls} resize-y`}
                />
              </Field>
            </div>
          </div>

          {/* Materials */}
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-600">Material & detail focus</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {MATERIALS.map((m) => {
                const on = materials.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMaterial(m)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      on
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guardrails */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-xs font-semibold text-slate-600">Production guardrails</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={gravity} onChange={(e) => setGravity(e.target.checked)} />
                Enforce gravity &amp; weight dynamics
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={noText} onChange={(e) => setNoText(e.target.checked)} />
                Suppress AI text &amp; floating badges
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={noMorph} onChange={(e) => setNoMorph(e.target.checked)} />
                Prevent limb &amp; joint morphing
              </label>
            </div>
          </div>

          {/* Compiled preview */}
          <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Compiled prompt (live)
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {positive || "Add a hero subject to start building your prompt."}
            </p>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                Auto-injected negative prompt (locked)
              </div>
              <p className="mt-1 text-xs text-slate-500">{FIXED_NEGATIVE}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={copyPrompt}
              disabled={!canBuild}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              {copied ? "Copied ✓" : "Copy prompt"}
            </button>

            {isPaid ? (
              <button
                onClick={generate}
                disabled={!canBuild || busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {busy ? "Starting…" : "Generate video"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  disabled
                  title="Upgrade to a paid plan to generate videos from the builder"
                  className="cursor-not-allowed rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-white"
                >
                  Generate video 🔒
                </button>
                <Link href="/dashboard/billing" className="text-xs font-semibold text-indigo-600 hover:underline">
                  Upgrade to unlock →
                </Link>
              </div>
            )}
          </div>

          {notice && <p className="mt-3 text-sm text-emerald-700" role="status">{notice}</p>}
          {error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
