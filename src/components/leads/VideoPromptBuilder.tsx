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
 * Designed for NON-TECHNICAL users: a guided default path (one-tap style
 * presets + four plain-language questions + a friendly summary), with all the
 * professional controls (full chip lists, cinema kit, guardrails, the raw
 * compiled prompt) tucked into an optional "Advanced" section that stays
 * collapsed. Guardrails default ON so output stays clean even if Advanced is
 * never opened. Compilation lives in ./promptCompiler.
 *
 * Access model:
 *  - Visible to any signed-in (verified) user — building and copying is free.
 *  - "Generate Video" is enabled only for PAID users; free users get an upgrade
 *    affordance and can still copy the prompt.
 */

// Camera dataset splits into framing (first FRAMING_COUNT) then movement.
const FRAMINGS = OPT.cameraFramingAndMovement.slice(0, FRAMING_COUNT);
const MOVEMENTS = OPT.cameraFramingAndMovement.slice(FRAMING_COUNT);

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300";

// One-tap starting points. Each fills the whole form with a sensible look so a
// non-technical user gets a strong result immediately, then tweaks if they wish.
type Preset = {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  hero: string;
  actors: string[];
  action: string;
  framing: string[];
  movements: string[];
  environments: string[];
  lighting: string[];
  materials: string[];
};

const PRESETS: Preset[] = [
  {
    id: "rider",
    emoji: "🏍️",
    title: "Rider & vehicle",
    blurb: "A person using a bike or car in motion",
    hero: "Dual-sport adventure motorcycle",
    actors: ["Experienced adventure motorcycle rider"],
    action:
      "Stepping firmly onto motorcycle footpeg with authentic weight transfer and sole traction",
    framing: ["Low-angle three-quarter tracking shot"],
    movements: ["Slow controlled push-in dolly"],
    environments: ["Wet coastal tarmac road at golden hour"],
    lighting: ["Warm golden-hour sunlight with dramatic lens flares"],
    materials: ["Matte rugged technical rubber and molded armor"],
  },
  {
    id: "product",
    emoji: "📦",
    title: "Product hero",
    blurb: "A close-up beauty shot of a product (no people)",
    hero: "Waterproof technical trail-running shoes",
    actors: [],
    action: "",
    framing: ["Macro close-up with shallow depth of field"],
    movements: ["Smooth 45-degree orbital arc rotation"],
    environments: ["Minimalist raw concrete architectural gallery"],
    lighting: ["High-contrast commercial studio edge rim lighting"],
    materials: [
      "Matte rugged technical rubber and molded armor",
      "Micro water droplets, condensation, and rain splashes",
    ],
  },
  {
    id: "app",
    emoji: "💻",
    title: "App / screen demo",
    blurb: "Software, a dashboard, or a device screen",
    hero: "Cloud infrastructure monitoring dashboard",
    actors: ["Senior software engineer"],
    action:
      "Navigating interactive data charts with precise cursor clicks and smooth viewport pans",
    framing: ["Eye-level medium commercial hero shot"],
    movements: ["Slow controlled push-in dolly"],
    environments: ["Corporate executive office with skyline glass walls"],
    lighting: ["Soft diffused overcast daylight with low shadows"],
    materials: ["High-luminance crisp OLED screen glass"],
  },
  {
    id: "food",
    emoji: "☕",
    title: "Food & drink",
    blurb: "A tasty, textured food or beverage moment",
    hero: "Commercial espresso group head pulling a shot",
    actors: [],
    action: "Pulling espresso with thick golden crema swirling into a warm ceramic cup",
    framing: ["Macro close-up with shallow depth of field"],
    movements: ["Slow controlled push-in dolly"],
    environments: ["Sunlit boutique cafe with exposed brickwork"],
    lighting: ["Warm golden-hour sunlight with dramatic lens flares"],
    materials: ["Micro water droplets, condensation, and rain splashes"],
  },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/**
 * A capped multi-select chip group (Advanced). Selecting past `max` drops the
 * oldest pick; clicking a selected chip removes it.
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
          {hint ?? `up to ${max}`} · {selected.length}/{max}
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

export type BuilderAccessProp = {
  level: "none" | "basic" | "advanced";
  basicMin: number;
  advancedMin: number;
};

export default function VideoPromptBuilder({ access }: { access: BuilderAccessProp }) {
  const canBasic = access.level !== "none"; // guided path usable
  const canAdvanced = access.level === "advanced"; // pro controls usable
  const isPaid = canBasic; // Generate is allowed from the basic tier up

  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("");

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

  // Production guardrails — default all true (kept on even if Advanced is closed).
  const [enforcePhysics, setEnforcePhysics] = useState(true);
  const [suppressText, setSuppressText] = useState(true);
  const [lockAnatomy, setLockAnatomy] = useState(true);
  const [rigidCollisions, setRigidCollisions] = useState(true);
  const [lockShutterSpeed, setLockShutterSpeed] = useState(true);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function applyPreset(p: Preset) {
    setActivePreset(p.id);
    setHero(p.hero);
    setActors(p.actors);
    setAction(p.action);
    setFraming(p.framing);
    setMovements(p.movements);
    setEnvironments(p.environments);
    setLighting(p.lighting);
    setMaterials(p.materials);
  }

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
      guardrails: { enforcePhysics, suppressText, lockAnatomy, rigidCollisions, lockShutterSpeed },
    };
    return compileVideoPrompts(state);
  }, [
    hero, actors, action, framing, movements, environments, lighting, materials,
    cameraBody, lensProfile, colorScience,
    enforcePhysics, suppressText, lockAnatomy, rigidCollisions, lockShutterSpeed,
  ]);

  const canBuild = hero.trim().length > 0;

  // Friendly, plain-English description of what will be generated.
  const summary = useMemo(() => {
    if (!canBuild) return "";
    const bits: string[] = [`a cinematic video of ${hero.trim()}`];
    if (actors.length) bits.push(`featuring ${actors.join(" and ")}`);
    if (environments.length) bits.push(`set in ${environments[0].toLowerCase()}`);
    if (action.trim()) bits.push(`showing it ${action.trim().replace(/\.$/, "").toLowerCase()}`);
    return `We will create ${bits.join(", ")}.`;
  }, [canBuild, hero, actors, environments, action]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(positivePrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy — open the prompt and copy it manually.");
    }
  }

  async function generate() {
    if (!isPaid) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
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
          <p className="mb-4 text-sm text-slate-600">
            Make a professional product video in three steps — no experience needed. Pick a style,
            answer a couple of questions, and generate.
          </p>

          {!canBasic && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Locked preview.</span> The AI Video Prompt Builder
              unlocks on a plan of at least {access.basicMin} credits/month, and the Advanced pro
              controls at {access.advancedMin} credits/month. Have a look below, then upgrade to use it.{" "}
              <Link href="/dashboard/billing" className="font-semibold text-indigo-600 hover:underline">
                See plans →
              </Link>
            </div>
          )}

          {/* STEP 1 + 2 — the guided (basic) path. Locked for below-basic plans. */}
          <fieldset disabled={!canBasic} className="m-0 border-0 p-0 disabled:opacity-60">

          {/* STEP 1 — style presets */}
          <div className="mb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              1 · Start with a style
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PRESETS.map((p) => {
                const on = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      on
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300"
                        : "border-slate-200 bg-white hover:border-indigo-300"
                    }`}
                  >
                    <div className="text-2xl">{p.emoji}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">{p.title}</div>
                    <div className="text-xs text-slate-500">{p.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2 — plain essentials */}
          <div className="mb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              2 · Tell us the basics
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="What are you featuring?">
                <input
                  list="hero-suggestions"
                  value={hero}
                  onChange={(e) => setHero(e.target.value)}
                  placeholder="e.g. Waterproof adventure boots"
                  className={inputCls}
                />
                <datalist id="hero-suggestions">
                  {OPT.heroSubjects.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>

              <Field label="Who is in it? (optional)">
                <select
                  value={actors[0] ?? ""}
                  onChange={(e) => setActors(e.target.value ? [e.target.value] : [])}
                  className={inputCls}
                >
                  <option value="">Just the product — no people</option>
                  {OPT.actorsAndWardrobe.slice(0, 7).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Where does it happen?">
                <select
                  value={environments[0] ?? ""}
                  onChange={(e) => setEnvironments(e.target.value ? [e.target.value] : [])}
                  className={inputCls}
                >
                  <option value="">No specific setting</option>
                  {OPT.environments.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Overall look & lighting">
                <select
                  value={lighting[0] ?? ""}
                  onChange={(e) => setLighting(e.target.value ? [e.target.value] : [])}
                  className={inputCls}
                >
                  <option value="">Let us choose</option>
                  {OPT.lightingAndAtmosphere.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="What happens in the shot? (optional)">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setAction(e.target.value);
                    }}
                    className={`${inputCls} mb-2`}
                  >
                    <option value="">Choose a common action…</option>
                    {OPT.actionsAndMechanics.map((a) => (
                      <option key={a} value={a}>
                        {a.length > 70 ? `${a.slice(0, 70)}…` : a}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    rows={2}
                    placeholder="Or describe it in your own words — e.g. the boots step onto the footpeg and the bike settles under the weight"
                    className={`${inputCls} resize-y`}
                  />
                </Field>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Quality &amp; safety filters (natural physics, clean footage, no glitchy limbs) are on
              automatically.
            </p>
          </div>

          </fieldset>

          {/* Advanced — everything technical lives here, collapsed by default */}
          <div className="mb-5 rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => { if (canAdvanced) setAdvanced((a) => !a); }}
              disabled={!canAdvanced}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left disabled:cursor-not-allowed"
            >
              <span className="text-xs font-semibold text-slate-600">
                Advanced controls (optional) — cinema kit, fine-tuning &amp; safety
                {!canAdvanced && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    🔒 unlocks at {access.advancedMin} credits/mo
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-indigo-600">
                {!canAdvanced ? "Locked" : advanced ? "Hide −" : "Show +"}
              </span>
            </button>

            {canAdvanced && advanced && (
              <div className="border-t border-slate-100 p-4">
                {/* Cinema kit */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs font-semibold text-slate-600">Cinema kit — optical &amp; colour profile</span>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <Field label="Camera body">
                      <select value={cameraBody} onChange={(e) => setCameraBody(e.target.value as CameraBody | "")} className={inputCls}>
                        <option value="">Auto (ARRI Alexa Mini LF)</option>
                        {CAMERA_BODIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </Field>
                    <Field label="Lens profile">
                      <select value={lensProfile} onChange={(e) => setLensProfile(e.target.value as LensProfile | "")} className={inputCls}>
                        <option value="">Auto (Anamorphic 35mm Prime)</option>
                        {LENS_PROFILES.map((l) => (<option key={l} value={l}>{l}</option>))}
                      </select>
                    </Field>
                    <Field label="Colour science">
                      <select value={colorScience} onChange={(e) => setColorScience(e.target.value as ColorScience | "")} className={inputCls}>
                        <option value="">Auto (graded commercial LUT)</option>
                        {COLOR_SCIENCES.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </Field>
                  </div>
                </div>

                {/* Full multi-select chip controls */}
                <div className="mt-4 grid gap-5">
                  <ChipGroup label="Actor & wardrobe" hint="pick 1–2" options={OPT.actorsAndWardrobe} selected={actors} onChange={setActors} max={2} />
                  <ChipGroup label="Camera framing" hint="pick 1" options={FRAMINGS} selected={framing} onChange={setFraming} max={1} />
                  <ChipGroup label="Camera movement" hint="up to 2" options={MOVEMENTS} selected={movements} onChange={setMovements} max={2} />
                  <ChipGroup label="Environment" hint="up to 3" options={OPT.environments} selected={environments} onChange={setEnvironments} max={3} />
                  <ChipGroup label="Lighting & atmosphere" hint="up to 2" options={OPT.lightingAndAtmosphere} selected={lighting} onChange={setLighting} max={2} />
                  <ChipGroup label="Material & finish focus" hint="up to 4" options={OPT.materialsAndFinishes} selected={materials} onChange={setMaterials} max={4} />
                </div>

                {/* Guardrails */}
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs font-semibold text-slate-600">Production guardrails — physics &amp; anti-artifact</span>
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
              </div>
            )}
          </div>

          {/* Friendly summary + optional raw prompt */}
          <div className="mb-4 rounded-lg border border-slate-300 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</div>
            <p className="mt-1 text-sm text-slate-800">
              {canBuild ? summary : "Pick a style above, or tell us what you are featuring, to begin."}
            </p>
            {canBuild && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPrompt((s) => !s)}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {showPrompt ? "Hide the exact prompt" : "Show the exact prompt (advanced)"}
                </button>
                {showPrompt && (
                  <div className="mt-2 space-y-2">
                    <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{positivePrompt}</p>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                        Auto-injected negative prompt (locked · adapts to guardrails)
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{negativePrompt}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
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
