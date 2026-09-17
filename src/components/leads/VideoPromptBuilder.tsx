"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PROMPT_BUILDER_OPTIONS as OPT, FRAMING_COUNT } from "./promptBuilderOptions";

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

  // Production guardrails — default all true.
  const [gravity, setGravity] = useState(true);
  const [noText, setNoText] = useState(true);
  const [noMorph, setNoMorph] = useState(true);
  const [orientation, setOrientation] = useState(true);
  const [noDuplicates, setNoDuplicates] = useState(true);
  const [temporal, setTemporal] = useState(true);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Compile the structured state into a single positive prompt. Unset fields are
  // dropped gracefully and redundant whitespace collapsed.
  const positive = useMemo(() => {
    const h = hero.trim();
    if (!h) return "";

    const camera = [...framing, ...movements].filter(Boolean).join(", ");
    const actorPhrase = actors.join(" and ");
    const envPhrase = environments.join(", ");
    const lightPhrase = lighting.join(" and ");
    const materialPhrase = materials.join(", ");

    const lead: string[] = [];
    lead.push(`${camera || "Cinematic commercial shot"} focused on ${h}`);
    if (actorPhrase) lead.push(`featuring ${actorPhrase}`);
    if (envPhrase) lead.push(`set in ${envPhrase}`);
    let sentence = lead.join(", ") + ".";

    if (lightPhrase) sentence += ` Lighting: ${lightPhrase}.`;

    sentence += action.trim()
      ? ` Action: ${action.trim()}, demonstrating authentic weight and fluid dynamics.`
      : " Demonstrating authentic weight and fluid dynamics.";

    if (materialPhrase) {
      sentence += ` Material focus: ${materialPhrase} highlighted with crisp commercial lighting and sharp edge contrast.`;
    }

    // Guardrails reinforce the positive side (the negative prompt is fixed below).
    if (gravity) sentence += " Strict physical gravity, weight transfer and realistic suspension compression.";
    if (orientation) sentence += " Correct anatomical and object orientation throughout, no reversed or backward limbs.";
    if (noMorph) sentence += " Anatomically correct limbs and joints, no morphing.";
    if (noDuplicates) sentence += " No duplicated, extra or missing limbs or objects.";
    if (temporal) sentence += " Temporally stable, no frame-to-frame warping or flicker.";
    if (noText) sentence += " No on-screen text, typography or floating badges.";

    sentence +=
      " Photorealistic, cinematic 24fps, high fidelity, clean footage, zero on-screen text, no overlays.";

    return sentence.replace(/\s+/g, " ").trim();
  }, [
    hero,
    actors,
    action,
    framing,
    movements,
    environments,
    lighting,
    materials,
    gravity,
    noText,
    noMorph,
    orientation,
    noDuplicates,
    temporal,
  ]);

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
    setBusy(true);
    try {
      // Confirm-before-spend: ask the server for the cost, then confirm.
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
                <input type="checkbox" checked={gravity} onChange={(e) => setGravity(e.target.checked)} />
                Enforce gravity &amp; weight dynamics
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={orientation} onChange={(e) => setOrientation(e.target.checked)} />
                Correct orientation (no reversed limbs)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={noMorph} onChange={(e) => setNoMorph(e.target.checked)} />
                Prevent limb &amp; joint morphing
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={noDuplicates} onChange={(e) => setNoDuplicates(e.target.checked)} />
                No duplicated / extra limbs or objects
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={temporal} onChange={(e) => setTemporal(e.target.checked)} />
                Temporal stability (no warping / flicker)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={noText} onChange={(e) => setNoText(e.target.checked)} />
                Suppress AI text &amp; floating badges
              </label>
            </div>
          </div>

          {/* Compiled preview */}
          <div className="mt-5 rounded-lg border border-slate-300 bg-white p-4">
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
