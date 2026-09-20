"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PROMPT_BUILDER_OPTIONS as OPT,
  CATEGORY_TAXONOMY,
  type SubjectCategory,
  FRAMING_COUNT,
  framingScope,
  actionScope,
  actionAllowedInScope,
  compatibleLenses,
  MACRO_LENS,
} from "./promptBuilderOptions";
import {
  compileVideoPrompts,
  CAMERA_BODIES,
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

// Category (Style) cards. Selecting one cascades the whole form: the downstream
// option lists (actors/environments/lighting/actions/materials + hero
// suggestions) are scoped to the category, and a sensible expert starting shot
// is applied. Data lives in CATEGORY_TAXONOMY (single source of truth).
const CATEGORY_META: Record<SubjectCategory, { emoji: string; blurb: string }> = {
  saas_digital: { emoji: "💻", blurb: "SaaS, apps, dashboards, AI tools" },
  b2b_service: { emoji: "📈", blurb: "Agency, consulting, logistics, finance" },
  physical_product: { emoji: "📦", blurb: "Hardware, wearables, consumer tech" },
  mobility_vehicle: { emoji: "🏍️", blurb: "Motorcycles, cars, EV, mobility gear" },
  food_beverage: { emoji: "☕", blurb: "Drinks, culinary, packaged goods" },
};
const CATEGORY_KEYS = Object.keys(CATEGORY_TAXONOMY) as SubjectCategory[];

// The category's defaultStyle → a strong cinematic starting shot (framing +
// movement). Framing/movement stay global because they are scale-scoped.
const STYLE_SHOT: Record<string, { framing: string; movement: string }> = {
  "App / screen demo": { framing: "Eye-level medium commercial hero shot", movement: "Slow controlled push-in dolly" },
  "Product hero": { framing: "Macro close-up with shallow depth of field", movement: "Smooth 45-degree orbital arc rotation" },
  "Rider & vehicle": { framing: "Low-angle three-quarter tracking shot", movement: "Slow controlled push-in dolly" },
  "Food & drink": { framing: "Macro close-up with shallow depth of field", movement: "Slow controlled push-in dolly" },
};

// Sentinel that means "no people" — the actor select already offers this as its
// empty option, so it is filtered out of the mapped option list.
const NO_PEOPLE = "Just the product — no people";

// The default category the builder opens on.
const DEFAULT_CATEGORY: SubjectCategory = "physical_product";

// Compute a coherent starting state for a category: option lists come from the
// taxonomy; framing/movement from the category's default style; one sensible
// pick per field (actors cleared under a macro shot to respect the scale guard).
function seedFor(cat: SubjectCategory) {
  const t = CATEGORY_TAXONOMY[cat];
  const shot = STYLE_SHOT[t.defaultStyle] ?? { framing: "", movement: "" };
  const macro = framingScope(shot.framing) === "macro";
  const firstActor = t.actors.find((a) => a !== NO_PEOPLE);
  return {
    hero: t.sampleSubjects[0] ?? "",
    framing: shot.framing ? [shot.framing] : [],
    movements: shot.movement ? [shot.movement] : [],
    actors: macro || !firstActor ? [] : [firstActor],
    environments: t.environments[0] ? [t.environments[0]] : [],
    lighting: t.lighting[0] ? [t.lighting[0]] : [],
    action: t.actions[0] ?? "",
    materials: t.materials[0] ? [t.materials[0]] : [],
  };
}
const DEFAULT_SEED = seedFor(DEFAULT_CATEGORY);

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

export default function VideoPromptBuilder({ access, isAdmin = false }: { access: BuilderAccessProp; isAdmin?: boolean }) {
  // Admin/owner preview: the owner always resolves to "advanced", but can flip
  // this local toggle to see EXACTLY what a Locked / Free (guided) / Advanced
  // user gets. It only changes the on-screen tier — the owner's real generation
  // rights are unaffected (the server still treats an admin as advanced).
  const [previewLevel, setPreviewLevel] = useState<"none" | "basic" | "advanced">(
    access.level === "none" ? "advanced" : access.level,
  );
  const effectiveLevel = isAdmin ? previewLevel : access.level;
  const canBasic = effectiveLevel !== "none"; // guided path usable
  const canAdvanced = effectiveLevel === "advanced"; // pro controls usable
  const isPaid = canBasic; // Generate is allowed from the basic tier up

  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [category, setCategory] = useState<SubjectCategory>(DEFAULT_CATEGORY);

  const [hero, setHero] = useState(DEFAULT_SEED.hero);
  const [actors, setActors] = useState<string[]>(DEFAULT_SEED.actors); // 1–2
  const [action, setAction] = useState(DEFAULT_SEED.action);
  const [framing, setFraming] = useState<string[]>(DEFAULT_SEED.framing); // exactly 1
  const [movements, setMovements] = useState<string[]>(DEFAULT_SEED.movements); // up to 2
  const [environments, setEnvironments] = useState<string[]>(DEFAULT_SEED.environments); // up to 3
  const [lighting, setLighting] = useState<string[]>(DEFAULT_SEED.lighting); // up to 2
  const [materials, setMaterials] = useState<string[]>(DEFAULT_SEED.materials); // up to 4
  const [duration, setDuration] = useState(6); // clip length (s) 4-15 — drives the linter's action budget
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [resolution, setResolution] = useState<"480p" | "720p" | "1080p">("720p"); // Higgsfield native

  // Image reference (Advanced) → Image-to-Video mode when present.
  const [imageRef, setImageRef] = useState<{ name: string; dataUrl: string } | null>(null);
  const [imageError, setImageError] = useState("");
  const mode: "t2v" | "i2v" = imageRef ? "i2v" : "t2v";

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

  // Category-scoped option lists — every downstream field reads from the active
  // category so the whole form stays coherent for that domain.
  const cat = CATEGORY_TAXONOMY[category];
  const catActors = cat.actors.filter((a) => a !== NO_PEOPLE);

  // Selecting a category cascades: repopulate the option lists AND seed a strong
  // expert starting point (hero, shot, one sensible pick per field), clearing
  // anything that doesn't belong to the new domain.
  function changeCategory(next: SubjectCategory) {
    setCategory(next);
    const s = seedFor(next);
    setHero(s.hero);
    setFraming(s.framing);
    setMovements(s.movements);
    setActors(s.actors);
    setEnvironments(s.environments);
    setLighting(s.lighting);
    setAction(s.action);
    setMaterials(s.materials);
  }

  // Current framing's scale scope drives which actions/lenses/actors are valid.
  const curFramingScope = framingScope(framing[0]);
  const allowedActions = cat.actions.filter((a) => actionAllowedInScope(a, curFramingScope));
  const allowedLenses = compatibleLenses(curFramingScope);
  const lensLocked = curFramingScope === "macro";
  const actorsDisabled = curFramingScope === "macro"; // actors morph scale in close-ups

  // Keep lens + action + actors coherent with the chosen framing scale — this is
  // what prevents the macro/full "scale hallucination". Used wherever framing is set.
  function changeFraming(next: string[]) {
    setFraming(next);
    const scope = framingScope(next[0]);
    if (scope === "macro") {
      if (lensProfile && lensProfile !== MACRO_LENS) setLensProfile(MACRO_LENS);
      if (action && actionScope(action) === "full") setAction(""); // drop a now-invalid full-body action
      if (actors.length) setActors([]);                             // no full-body actor in a macro shot
    } else if (scope === "full" && lensProfile === MACRO_LENS) {
      setLensProfile(""); // back to Auto (a full-scope lens)
    }
  }

  // Assemble the pro state and compile to a positive/negative pair (plus the
  // pre-flight linter's list of auto-corrections).
  const { positivePrompt, negativePrompt, corrections } = useMemo(() => {
    const state: ProVideoPromptState = {
      heroSubject: hero.trim(),
      actors,
      action: action.trim(),
      camera: [...framing, ...movements].filter(Boolean),
      environments,
      lighting,
      materials,
      durationSeconds: duration,
      aspectRatio,
      resolution,
      mode,
      cinemaKit: {
        cameraBody: cameraBody || undefined,
        lensProfile: lensProfile || undefined,
        colorScience: colorScience || undefined,
      },
      guardrails: { enforcePhysics, suppressText, lockAnatomy, rigidCollisions, lockShutterSpeed },
    };
    return compileVideoPrompts(state);
  }, [
    hero, actors, action, framing, movements, environments, lighting, materials, duration, aspectRatio, resolution, mode,
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

  // Reference image (Image-to-Video). Read client-side as a data URL for the
  // thumbnail preview and to ship in the build payload; the runner materializes
  // it to a temp file for `--image`. Capped so it fits the request/metadata.
  const IMG_MAX_BYTES = 2_000_000; // ~2 MB original
  function handleImageFile(file: File | null | undefined) {
    setImageError("");
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setImageError("Use a .png, .jpg, or .webp image.");
      return;
    }
    if (file.size > IMG_MAX_BYTES) {
      setImageError("Image is too large — keep it under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageRef({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => setImageError("Could not read that image.");
    reader.readAsDataURL(file);
  }

  async function generate() {
    if (!isPaid) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const payload = {
        positive: positivePrompt,
        negative: negativePrompt,
        resolution,
        duration,
        aspectRatio,
        mode,
        ...(mode === "i2v" && imageRef ? { image: imageRef.dataUrl } : {}),
      };
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
        `Generate this ${resolution} ${mode === "i2v" ? "image-to-video" : "commercial"} render now? (${duration}s · ${aspectRatio})\n\n~${est.estimatedCredits} credits — the base rate; longer clips and higher resolution cost more.\nIt renders in the background and appears in your Video Studio project.`,
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

          {isAdmin && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                Admin preview · view as
              </span>
              {([
                ["none", "Locked"],
                ["basic", "Free (Guided)"],
                ["advanced", "Advanced (Pro)"],
              ] as const).map(([lvl, lbl]) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setPreviewLevel(lvl)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    previewLevel === lvl
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-violet-300 bg-white text-violet-700 hover:border-violet-500"
                  }`}
                >
                  {lbl}
                </button>
              ))}
              <span className="basis-full text-[11px] text-violet-600">
                Only you (owner/admin) see this. It previews exactly what each tier shows — your own generation rights are unaffected.
              </span>
            </div>
          )}

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

          {/* STEP 1 — subject category (cascades every downstream option) */}
          <div className="mb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              1 · What are you promoting?
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {CATEGORY_KEYS.map((key) => {
                const c = CATEGORY_TAXONOMY[key];
                const meta = CATEGORY_META[key];
                const on = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeCategory(key)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      on
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300"
                        : "border-slate-200 bg-white hover:border-indigo-300"
                    }`}
                  >
                    <div className="text-2xl">{meta.emoji}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">{c.label}</div>
                    <div className="text-xs text-slate-500">{meta.blurb}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Pick the domain — the people, settings, lighting, actions and materials below all adapt to it.
            </p>
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
                  placeholder={cat.heroPlaceholder}
                  className={inputCls}
                />
                <datalist id="hero-suggestions">
                  {cat.sampleSubjects.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>

              <Field label="Who is in it? (optional)">
                <select
                  value={actorsDisabled ? "" : (actors[0] ?? "")}
                  onChange={(e) => setActors(e.target.value ? [e.target.value] : [])}
                  disabled={actorsDisabled}
                  className={`${inputCls} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                >
                  <option value="">Just the product — no people</option>
                  {catActors.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                {actorsDisabled && (
                  <span className="mt-1 text-[11px] text-amber-700">
                    Actors are automatically disabled for macro/detail shots to prevent scale distortion.
                  </span>
                )}
              </Field>

              <Field label="Where does it happen?">
                <select
                  value={environments[0] ?? ""}
                  onChange={(e) => setEnvironments(e.target.value ? [e.target.value] : [])}
                  className={inputCls}
                >
                  <option value="">No specific setting</option>
                  {cat.environments.map((v) => (
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
                  {cat.lighting.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Shot type — how close is the camera?">
                <select
                  value={framing[0] ?? ""}
                  onChange={(e) => changeFraming(e.target.value ? [e.target.value] : [])}
                  className={inputCls}
                >
                  <option value="">Auto — cinematic default</option>
                  {FRAMINGS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                {actorsDisabled ? (
                  <span className="mt-1 text-[11px] text-amber-700">
                    Close-up / detail shots turn off people to keep scale natural — pick a medium or wide shot to add someone.
                  </span>
                ) : (
                  <span className="mt-1 text-[11px] text-slate-400">
                    Sets how much of the subject is in frame — the camera and lens are matched for you.
                  </span>
                )}
              </Field>

              <Field label="Camera movement (optional)">
                <select
                  value={movements[0] ?? ""}
                  onChange={(e) => setMovements(e.target.value ? [e.target.value] : [])}
                  className={inputCls}
                >
                  <option value="">Still / locked-off</option>
                  {MOVEMENTS.map((m) => (
                    <option key={m} value={m}>
                      {m}
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
                    className={`${inputCls} mb-1`}
                  >
                    <option value="">Choose a common action…</option>
                    {allowedActions.map((a) => (
                      <option key={a} value={a}>
                        {a.length > 70 ? `${a.slice(0, 70)}…` : a}
                      </option>
                    ))}
                  </select>
                  {lensLocked && (
                    <p className="mb-2 text-[11px] text-slate-400">
                      Full-body actions (mounting, running) are hidden — the selected close-up style only works with fine-detail motion.
                    </p>
                  )}
                  <textarea
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    rows={2}
                    placeholder="Or describe it in your own words — e.g. the boots step onto the footpeg and the bike settles under the weight"
                    className={`${inputCls} resize-y`}
                  />
                  {duration >= 8 && (
                    <p className="mt-1 text-[11px] text-emerald-700">
                      Longer durations (8s–15s) support sequential micro-actions without stalling.
                    </p>
                  )}
                </Field>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-semibold text-slate-600">Clip length</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[4, 5, 6, 8, 10, 12, 15].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDuration(s)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        duration === s
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {duration <= 6
                    ? `We keep ${duration}s to a single clean action so the motion never stutters.`
                    : `At ${duration}s we allow a short sequence of micro-actions without stalling.`}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600">Resolution</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["480p", "720p", "1080p"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResolution(r)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        resolution === r
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {resolution === "1080p"
                    ? "Full HD — richest detail; costs more credits than 720p/480p."
                    : resolution === "480p"
                      ? "Draft quality — the cheapest, fastest render."
                      : "Balanced default — crisp HD at a moderate credit cost."}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs font-semibold text-slate-600">Aspect ratio</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {([
                  ["16:9", "16:9 Landscape"],
                  ["9:16", "9:16 Vertical (Story / Ad)"],
                  ["1:1", "1:1 Square"],
                ] as const).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAspectRatio(val)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      aspectRatio === val
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
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
                {/* Image reference (Image-to-Video) */}
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-slate-600">Image reference (optional)</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mode === "i2v" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                      {mode === "i2v" ? "Image-to-Video" : "Text-to-Video"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Drop a still and we animate <em>it</em> — preserving its exact geometry, textures and colour, then driving
                    camera motion and physics over it.
                  </p>

                  {imageRef ? (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageRef.dataUrl}
                        alt="Reference preview"
                        className="h-16 w-16 rounded-md border border-slate-300 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-700">{imageRef.name}</div>
                        <button
                          type="button"
                          onClick={() => { setImageRef(null); setImageError(""); }}
                          className="mt-1 text-[11px] font-semibold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); handleImageFile(e.dataTransfer.files?.[0]); }}
                      className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center hover:border-indigo-400"
                    >
                      <span className="text-xs font-semibold text-slate-600">Drag &amp; drop an image, or click to browse</span>
                      <span className="mt-0.5 text-[11px] text-slate-400">PNG, JPG or WEBP · up to 2 MB</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleImageFile(e.target.files?.[0])}
                      />
                    </label>
                  )}
                  {imageError && <p className="mt-1 text-[11px] text-rose-600">{imageError}</p>}
                </div>

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
                        <option value="">Auto ({lensLocked ? MACRO_LENS : "Anamorphic 35mm Prime"})</option>
                        {allowedLenses.map((l) => (<option key={l} value={l}>{l}</option>))}
                      </select>
                      {lensLocked && (
                        <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Macro framing requires macro telephoto optics
                        </span>
                      )}
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
                  {actorsDisabled ? (
                    <div className="opacity-50">
                      <ChipGroup label="Actor & wardrobe" hint="disabled for macro/detail shots" options={catActors} selected={[]} onChange={() => {}} max={2} />
                    </div>
                  ) : (
                    <ChipGroup label="Actor & wardrobe" hint="pick 1–2" options={catActors} selected={actors} onChange={setActors} max={2} />
                  )}
                  <ChipGroup label="Camera framing" hint="pick 1" options={FRAMINGS} selected={framing} onChange={changeFraming} max={1} />
                  <ChipGroup label="Camera movement" hint="up to 2" options={MOVEMENTS} selected={movements} onChange={setMovements} max={2} />
                  <ChipGroup label="Environment" hint="up to 3" options={cat.environments} selected={environments} onChange={setEnvironments} max={3} />
                  <ChipGroup label="Lighting & atmosphere" hint="up to 2" options={cat.lighting} selected={lighting} onChange={setLighting} max={2} />
                  <ChipGroup label="Material & finish focus" hint="up to 4" options={cat.materials} selected={materials} onChange={setMaterials} max={4} />
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
            {canBuild && corrections.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Auto-corrected for a clean render
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                  {corrections.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
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
