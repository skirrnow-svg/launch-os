"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PROMPT_BUILDER_OPTIONS as OPT, FRAMING_COUNT } from "./promptBuilderOptions";
import {
  compileVideoPrompts,
  CAMERA_BODIES,
  LENS_PROFILES,
  COLOR_SCIENCES,
  type ProVideoPromptState,
  type CameraBody,
  type LensProfile,
  type ColorScience,
} from "./promptCompiler";

/**
 * Universal AI Video Prompt Builder (see Instructions/videogenpromptgen.txt).
 *
 * A guided form that assembles non-technical inputs into a clean, physically
 * accurate commercial video prompt in real time — now with professional
 * cinematography controls (camera body, lens, colour science, shutter/physics
 * guardrails). Compilation and the dynamic negative prompt live in
 * ./promptCompiler.
 *
 * Access model:
 *  - Visible to any signed-in (verified) user — building and copying a prompt is
 *    always available.
 *  - "Generate Video" is enabled only for PAID users (isPaid). Free users see an
 *    upgrade affordance instead; they can still copy the prompt.
 */

// Camera dataset splits into framing (first FRAMING_COUNT) then movement.
const FRAMINGS = OPT.cameraFramingAndMovement.slice(0, FRAMING_COUNT);
const MOVEMENTS = OPT.cameraFramingAndMovement.slice(FRAMING_COUNT);

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/**
 * A capped multi-select chip group. Selecting past `max` drops the oldest pick
 * (never blocks the click); clicking a selected chip removes it.
 */
function ChipGroup({
  label,
  hint,
  options,
  selected,
  onChange,
  max,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  function toggle(item: string) {
    if (selected.includes(item)) {
      onChange(selected.filter((x) => x !== item));
      return;
    }
    if (max === 1) {
      onChange([item]);
      return;
    }
    onChange(selected.length >= max ? [...selected.slice(1), item] : [...selected, item]);
  }
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="text-[11px] text-slate-400">
          {hint ?? `choose up to ${max}`} · {selected.length}/{max}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function VideoPromptBuilder({ isPaid }: { isPaid: boolean }) {
  const [open, setOpen] = useState(false);

  const [hero, setHero] = useState("");
  const [actors, setActors] = useState<string[]>([]); // 1–2
  const [action, setAction] = useState("");
  const [framing, setFraming] = useState<string[]>([]); // exactly 1
  const [movements, setMovements] = useState<string[]>([]); // up to 2
  const [environments, setEnvironments] = useState<string[]>([]); // up to 3
  const [lighting, setLighting] = useState<string[]>([]); // up to 2
  const [materials, setMaterials] = useState<string[]>([]); // up to 4

  // Cinema kit — optical/colour profiles ("" = Auto → compiler default).
  const [cameraBody, setCameraBody] = useState<CameraBody | "">("");
  const [lensProfile, setLensProfile] = useState<LensProfile | "">("");
  const [colorScience, setColorScience] = useState<ColorScience | "">("");

  // Production guardrails — default all true.
  const [enforcePhysics, setEnforcePhysics] = useState(true);
  const [suppressText, setSuppressText] = useState(true);
  const [lockAnatomy, setLockAnatomy] = useState(true);
  const [rigidCollisions, setRigidCollisions] = useState(true);
  const [lockShutterSpeed, setLockShutterSpeed] = useState(true);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Assemble the pro state and compile to a positive/negative pair.
  const { positivePrompt, negativePrompt } = useMemo(() => {
    const state: ProVideoPromptState = {
      heroSubject: hero.trim(),
      actors,
      action: action.trim(),
      camera: [...framing, ...movements].filter(Boolean),
      environments,
      lighting,
      materials,
      cinemaKit: {
        cameraBody: cameraBody || undefined,
        lensProfile: lensProfile || undefined,
        colorScience: colorScience || undefined,
      },
      guardrails: {
        enforcePhysics,
        suppressText,
        lockAnatomy,
        rigidCollisions,
        lockShutterSpeed,
      },
    };
    return compileVideoPrompts(state);
  }, [
    hero,
    actors,
    action,
    framing,
    movements,
    environments,
    lighting,
    materials,
    cameraBody,
    lensProfile,
    colorScience,
    enforcePhysics,
    suppressText,
    lockAnatomy,
    rigidCollisions,
    lockShutterSpeed,
  ]);

  // Require at least a hero subject before the prompt is meaningful.
  const canBuild = hero.trim().length > 0;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(positivePrompt);
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
    setBusy(true);
    try {
      // Confirm-before-spend: ask the server for the cost, then confirm.
      const payload = { positive: positivePrompt, negative: negativePrompt };
      const pre = await fetch("/api/leads/video/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        body: JSON.stringify({ ...payload, confirmed: true }),
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
            prompt for you — with a professional cinema kit and a production-grade safety filter
            baked in. Copy it anywhere, or generate the video directly.
          </p>

          {/* Hero + action */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Hero subject — the product or UI">
              <input
                list="hero-suggestions"
                value={hero}
                onChange={(e) => setHero(e.target.value)}
                placeholder="Pick a preset or type your own"
                className={inputCls}
              />
              <datalist id="hero-suggestions">
                {OPT.heroSubjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>

            <Field label="Core action & mechanics — insert a preset, then edit freely">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setAction(e.target.value);
                }}
                className={inputCls}
              >
                <option value="">Insert a preset action…</option>
                {OPT.actionsAndMechanics.map((a) => (
                  <option key={a} value={a}>
                    {a.length > 70 ? `${a.slice(0, 70)}…` : a}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Action text (editable)">
              <textarea
                value={action}
                onChange={(e) => setAction(e.target.value)}
                rows={2}
                placeholder="e.g. Stepping firmly onto the footpeg with authentic weight transfer and sole traction"
                className={`${inputCls} resize-y`}
              />
            </Field>
          </div>

          {/* Cinema kit */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-xs font-semibold text-slate-600">
              Cinema kit — optical &amp; colour profile
            </span>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Field label="Camera body">
                <select value={cameraBody} onChange={(e) => setCameraBody(e.target.value as CameraBody | "")} className={inputCls}>
                  <option value="">Auto (ARRI Alexa Mini LF)</option>
                  {CAMERA_BODIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lens profile">
                <select value={lensProfile} onChange={(e) => setLensProfile(e.target.value as LensProfile | "")} className={inputCls}>
                  <option value="">Auto (Anamorphic 35mm Prime)</option>
                  {LENS_PROFILES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Colour science">
                <select value={colorScience} onChange={(e) => setColorScience(e.target.value as ColorScience | "")} className={inputCls}>
                  <option value="">Auto (graded commercial LUT)</option>
                  {COLOR_SCIENCES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Chip groups */}
          <div className="mt-5 grid gap-5">
            <ChipGroup
              label="Actor & wardrobe"
              hint="pick 1–2"
              options={OPT.actorsAndWardrobe}
              selected={actors}
              onChange={setActors}
              max={2}
            />
            <ChipGroup
              label="Camera framing"
              hint="pick 1"
              options={FRAMINGS}
              selected={framing}
              onChange={setFraming}
              max={1}
            />
            <ChipGroup
              label="Camera movement"
              hint="up to 2"
              options={MOVEMENTS}
              selected={movements}
              onChange={setMovements}
              max={2}
            />
            <ChipGroup
              label="Environment"
              hint="up to 3"
              options={OPT.environments}
              selected={environments}
              onChange={setEnvironments}
              max={3}
            />
            <ChipGroup
              label="Lighting & atmosphere"
              hint="up to 2"
              options={OPT.lightingAndAtmosphere}
              selected={lighting}
              onChange={setLighting}
              max={2}
            />
            <ChipGroup
              label="Material & finish focus"
              hint="up to 4"
              options={OPT.materialsAndFinishes}
              selected={materials}
              onChange={setMaterials}
              max={4}
            />
          </div>

          {/* Guardrails */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-xs font-semibold text-slate-600">
              Production guardrails — physics &amp; anti-artifact
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={enforcePhysics} onChange={(e) => setEnforcePhysics(e.target.checked)} />
                Enforce rigid-body physics &amp; gravity
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={lockAnatomy} onChange={(e) => setLockAnatomy(e.target.checked)} />
                Lock anatomy &amp; forward orientation
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={rigidCollisions} onChange={(e) => setRigidCollisions(e.target.checked)} />
                Rigid collisions (zero clipping)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={lockShutterSpeed} onChange={(e) => setLockShutterSpeed(e.target.checked)} />
                Lock 180° shutter (no motion blur)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={suppressText} onChange={(e) => setSuppressText(e.target.checked)} />
                Suppress AI text &amp; floating logos
              </label>
            </div>
          </div>

          {/* Compiled preview */}
          <div className="mt-5 rounded-lg border border-slate-300 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Compiled positive prompt (live)
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {canBuild ? positivePrompt : "Add a hero subject to start building your prompt."}
            </p>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                Auto-injected negative prompt (locked · adapts to guardrails)
              </div>
              <p className="mt-1 text-xs text-slate-500">{negativePrompt}</p>
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
                <Link
                  href="/dashboard/billing"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
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
