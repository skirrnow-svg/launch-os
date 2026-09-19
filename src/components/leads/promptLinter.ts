/**
 * Pre-Flight Prompt Linter & Sanitizer (middleware).
 *
 * Runs BEFORE a compiled video prompt is finalized, detecting and correcting the
 * four failure classes that make the generation model hallucinate scale:
 *   1. Optical contradictions (lens focal length vs. field-of-view framing)
 *   2. Spatial/framing conflicts (macro framing + whole-body / large-vehicle action)
 *   3. Mechanical overload (too many simultaneous physical events for the clip length)
 *   4. Contextual redundancies (full-body / vehicle / actor clauses lingering in macro)
 *
 * Two entry points, one rule set:
 *   • sanitizeAndCompilePrompt(req)  — the standalone contract (flat request in,
 *     one sanitized prompt + corrections out).
 *   • preflightLint(input)           — field-level sanitiser the rich
 *     compileVideoPrompts() runs so the app pipeline gets the same corrections
 *     while keeping its cinema-kit / colour / negative-prompt features.
 */
import { framingScope, actionScope } from "./promptBuilderOptions";

export interface VideoPromptRequest {
  durationSeconds: number; // e.g., 4 or 6
  framing: string;
  lens: string;
  heroSubject: string;
  actor?: string;
  action: string;
  environment: string;
  lighting: string;
  materials: string[];
  physicsGuards: string[];
}

const MACRO_LENS = "90mm Macro Cine Prime";
const WIDE_LENS = "Anamorphic 35mm Prime";
const STANDARD_LENS = "Cooke S4/i 50mm Prime";

/** Macro if the framing is scope-tagged macro OR reads as a close-up. */
export function isMacroFraming(framing: string): boolean {
  return framingScope(framing) === "macro" || /macro|close-?up|extreme (tight|detail)/i.test(framing);
}
function isWideFraming(framing: string): boolean {
  return /wide|environmental|establishing|panoram/i.test(framing);
}

/** Rule 1 — align the lens to the framing's field of view. */
export function alignOptics(framing: string, lens: string): { lens: string; correction?: string } {
  if (isMacroFraming(framing)) {
    if (!/macro/i.test(lens)) {
      return { lens: MACRO_LENS, correction: `Swapped ${lens} to ${MACRO_LENS} — macro framing needs macro/telephoto optics.` };
    }
    return { lens };
  }
  if (isWideFraming(framing)) {
    if (/macro/i.test(lens)) {
      return { lens: WIDE_LENS, correction: `Swapped ${lens} to ${WIDE_LENS} — wide/environmental framing needs wide optics.` };
    }
    return { lens };
  }
  // Medium / tracking.
  if (/macro/i.test(lens)) {
    return { lens: STANDARD_LENS, correction: `Swapped ${lens} to ${STANDARD_LENS} — medium/tracking framing needs standard optics.` };
  }
  return { lens };
}

const FULL_BODY_ACTION = /mount|running stride|running|accelerat|jump|stride|footpeg|throttle|pivot turn/i;

/** A localized micro-action fallback for a full-body action under macro framing. */
function microFallback(action: string, heroSubject: string): string {
  if (/mount|footpeg|peg|throttle|gear|shift/i.test(action))
    return "Foot resting firmly on the peg, subtly actuating the gear shifter with a crisp mechanical click";
  if (/run|stride|walk|step|tread|gravel/i.test(action))
    return "Sole tread flexing on contact with fine surface traction and micro-texture detail";
  return `Subtle surface flex and fine micro-motion detail on ${heroSubject || "the hero subject"}`;
}

/** Rule 2 — under macro framing, replace a whole-body action with a micro-action. */
export function lockActionToFraming(
  framing: string, action: string, heroSubject: string,
): { action: string; correction?: string } {
  if (!action) return { action };
  const macro = isMacroFraming(framing);
  const full = actionScope(action) === "full" || FULL_BODY_ACTION.test(action);
  if (macro && full) {
    return { action: microFallback(action, heroSubject), correction: "Replaced a whole-body action with a localized micro-action to fit the close-up scale." };
  }
  return { action };
}

/** Rule 3 — cap simultaneous physical events for the clip length. */
export function capActionDensity(action: string, durationSeconds: number): { action: string; correction?: string } {
  if (!action) return { action };
  // Temporal density: <=6s enforces a single action (motion-clutter guard);
  // 8-10s allows two sequential micro-actions; 12-15s allows three.
  const maxClauses = durationSeconds <= 6 ? 1 : durationSeconds <= 10 ? 2 : 3;
  const clauses = action.split(/,|\band\b|\bwith\b/i).map((c) => c.trim()).filter(Boolean);
  if (clauses.length > maxClauses) {
    const kept = clauses.slice(0, maxClauses).join(maxClauses > 1 ? " with " : "");
    return { action: kept, correction: `Trimmed ${clauses.length} stacked movements to ${maxClauses} — a ${durationSeconds}s clip can't cleanly show more.` };
  }
  return { action };
}

/** Rule 4a — drop full-body actor + vehicle-frame physics inside a macro shot. */
export function pruneMacroRedundancy(
  framing: string, actor: string | undefined, physicsGuards: string[],
): { actor?: string; physicsGuards: string[]; corrections: string[] } {
  const corrections: string[] = [];
  let resolvedActor = actor;
  let resolvedPhysics = [...physicsGuards];
  if (isMacroFraming(framing)) {
    if (resolvedActor) { resolvedActor = undefined; corrections.push("Removed the full-body actor from a macro shot to prevent scale morphing."); }
    const before = resolvedPhysics.length;
    resolvedPhysics = resolvedPhysics.filter((p) => !/mechanical frame|suspension|chassis|vehicle/i.test(p));
    if (resolvedPhysics.length !== before) corrections.push("Dropped vehicle-chassis physics — not applicable to an isolated macro subject.");
  }
  return { actor: resolvedActor, physicsGuards: resolvedPhysics, corrections };
}

/** Rule 4b — collapse the wet/water/rain adjective family and de-duplicate. */
export function dedupeMaterials(materials: string[]): { materials: string[]; correction?: string } {
  const waterFamily = /wet|water droplet|rain splash|condensation|moist/i;
  let touchedWater = false;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of materials) {
    if (waterFamily.test(m)) {
      if (!touchedWater) { out.push("rain droplets and fine condensation beads"); touchedWater = true; }
      continue;
    }
    const key = m.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  const changed = out.length !== materials.length || touchedWater;
  return { materials: out, correction: changed ? "Collapsed overlapping moisture/finish terms into one clean surface descriptor." : undefined };
}

/* ------------------------------------------------------------------ *
 * Integration hook for the rich compiler.
 * ------------------------------------------------------------------ */
export interface PreflightInput {
  framing: string;
  lens: string;
  action: string;
  actors: string[];
  materials: string[];
  heroSubject: string;
  durationSeconds: number;
  rigidCollisions: boolean; // whether the mechanical-frame clause would be added
}
export interface PreflightResult {
  lens: string;
  action: string;
  actors: string[];
  materials: string[];
  rigidCollisions: boolean;
  corrections: string[];
}

export function preflightLint(input: PreflightInput): PreflightResult {
  const corrections: string[] = [];

  // Rule 1 — optics.
  const optics = alignOptics(input.framing, input.lens);
  if (optics.correction) corrections.push(optics.correction);

  // Rule 2 — action scope, then Rule 3 — action density.
  const scoped = lockActionToFraming(input.framing, input.action, input.heroSubject);
  if (scoped.correction) corrections.push(scoped.correction);
  const capped = capActionDensity(scoped.action, input.durationSeconds);
  if (capped.correction) corrections.push(capped.correction);

  // Rule 4 — redundancy pruning.
  const macro = isMacroFraming(input.framing);
  let actors = input.actors;
  let rigidCollisions = input.rigidCollisions;
  if (macro) {
    if (actors.length) { actors = []; corrections.push("Removed the full-body actor from a macro shot to prevent scale morphing."); }
    if (rigidCollisions) { rigidCollisions = false; corrections.push("Dropped vehicle-chassis physics — not applicable to an isolated macro subject."); }
  }
  const mats = dedupeMaterials(input.materials);
  if (mats.correction) corrections.push(mats.correction);

  return { lens: optics.lens, action: capped.action, actors, materials: mats.materials, rigidCollisions, corrections };
}

/* ------------------------------------------------------------------ *
 * Standalone contract (flat request → one sanitized prompt + corrections).
 * ------------------------------------------------------------------ */
export function sanitizeAndCompilePrompt(req: VideoPromptRequest): {
  sanitizedPrompt: string;
  correctionsMade: string[];
} {
  const corrections: string[] = [];

  const optics = alignOptics(req.framing, req.lens);
  if (optics.correction) corrections.push(optics.correction);

  const scoped = lockActionToFraming(req.framing, req.action, req.heroSubject);
  if (scoped.correction) corrections.push(scoped.correction);
  const capped = capActionDensity(scoped.action, req.durationSeconds);
  if (capped.correction) corrections.push(capped.correction);

  const pruned = pruneMacroRedundancy(req.framing, req.actor, req.physicsGuards);
  corrections.push(...pruned.corrections);

  const mats = dedupeMaterials(req.materials);
  if (mats.correction) corrections.push(mats.correction);

  const components = [
    `Captured on ARRI Alexa Mini LF with ${optics.lens}, ${req.framing} focused on ${req.heroSubject}`,
    pruned.actor ? `featuring ${pruned.actor}` : null,
    `set in ${req.environment} with ${req.lighting}`,
    `Action: ${capped.action}`,
    mats.materials.length ? `Tactile surface details highlighting ${mats.materials.join(", ")}` : null,
    pruned.physicsGuards.join(", ") || null,
    "24fps, strict 180-degree shutter angle, zero digital motion blur, clean broadcast footage, zero text, no watermarks",
  ].filter(Boolean);

  return {
    sanitizedPrompt: components.join(". ").replace(/\.\./g, ".").replace(/\s+/g, " ").trim() + ".",
    correctionsMade: corrections,
  };
}
