/**
 * Pro prompt compiler for the AI Video Prompt Builder.
 *
 * Assembles the builder's structured state into a positive/negative prompt pair
 * with professional cinematography controls: optical profiles (camera body +
 * lens), directional lighting geometry, temporal shutter rules, colour science,
 * and rigid-body physics enforcement. The negative prompt is DYNAMIC — it grows
 * with the guardrails that are enabled.
 *
 * Scale safety: before assembling, framing/action/lens are run through
 * resolveScaleConflicts so a macro framing can never be paired with a full-body
 * action or a wide/anamorphic lens (the cause of scale-hallucination artifacts).
 */
import { FRAMING_SCOPE } from "./promptBuilderOptions";
import { preflightLint } from "./promptLinter";

export interface ProVideoPromptState {
  heroSubject: string;
  actors: string[];
  action: string;
  camera: string[];
  environments: string[];
  lighting: string[];
  materials: string[];
  durationSeconds?: number; // clip length (4-15s); drives the linter's action-density cap
  aspectRatio?: "16:9" | "9:16" | "1:1"; // compositional framing guardrail
  resolution?: "480p" | "720p" | "1080p"; // Higgsfield native resolution
  mode?: "t2v" | "i2v"; // i2v = a reference image is supplied (Image-to-Video)
  cinemaKit?: {
    cameraBody?: "ARRI Alexa Mini LF" | "RED V-Raptor 8K" | "Sony FX9" | "35mm Cine Camera";
    lensProfile?: "Anamorphic 35mm Prime" | "Cooke S4/i 50mm Prime" | "90mm Macro Cine Prime";
    colorScience?: "ARRI LogC3 / Kodak 2383 LUT" | "Commercial High-Contrast Neutral";
  };
  guardrails: {
    enforcePhysics: boolean;
    suppressText: boolean;
    lockAnatomy: boolean;
    rigidCollisions?: boolean;
    lockShutterSpeed?: boolean;
  };
}

export function compileVideoPrompts(state: ProVideoPromptState) {
  const parts: string[] = [];

  const cameraRig = state.cinemaKit?.cameraBody || "ARRI Alexa Mini LF";

  // Split camera into framings vs movements.
  const framings = state.camera.filter((c) => c in FRAMING_SCOPE);
  const movements = state.camera.filter((c) => !(c in FRAMING_SCOPE));
  const effectiveLens = state.cinemaKit?.lensProfile || "Anamorphic 35mm Prime";
  const duration = state.durationSeconds ?? 4;

  // PRE-FLIGHT LINT & SANITIZE — optics alignment, action-scope lock, action-
  // density cap, and redundancy pruning. Returns corrected fields + a list of
  // what was changed (surfaced to the user).
  const lint = preflightLint({
    framing: framings[0] ?? "",
    lens: effectiveLens,
    action: state.action,
    actors: state.actors,
    materials: state.materials,
    heroSubject: state.heroSubject,
    durationSeconds: duration,
    rigidCollisions: state.guardrails.rigidCollisions ?? true,
  });
  const lens = lint.lens;
  const i2v = state.mode === "i2v";

  // IMAGE-TO-VIDEO: the reference frame already carries the subject's geometry,
  // textures, silhouette and static colour — so we drop static surface/aesthetic
  // description and spend the token budget on MOTION: camera vector, mechanical
  // contact physics, and dynamic lighting shifts across the existing geometry.
  if (i2v) {
    parts.push(
      "Image-to-Video dynamic motion: Preserving exact visual geometry, textures, and silhouette from reference frame",
    );
  }

  const cameraTerms = [...framings, ...movements].filter(Boolean);
  const framing = cameraTerms.length ? cameraTerms.join(", ") : "Cinematic commercial tracking shot";
  if (i2v) {
    // Camera vector only — no static "focused on <subject>" re-description.
    const vector = movements.length ? movements.join(", ") : "slow controlled push-in dolly";
    parts.push(`Camera vector: ${vector} on ${cameraRig} with ${lens}`);
  } else {
    parts.push(`Captured on ${cameraRig} with ${lens}, ${framing} focused on ${state.heroSubject || "the hero subject"}`);
    if (lint.actors.length) parts.push(`featuring ${lint.actors.join(" and ")}`);
  }

  const envLight: string[] = [];
  if (!i2v && state.environments.length) envLight.push(`set in ${state.environments.join(", ")}`);
  if (state.lighting.length) {
    envLight.push(
      i2v
        ? `dynamic lighting shifts across the existing geometry via ${state.lighting.join(" and ")}`
        : `directional lighting via ${state.lighting.join(" and ")}`,
    );
  }
  if (envLight.length) parts.push(envLight.join(", "));

  if (lint.action) parts.push(`Action: ${lint.action}`);

  // Static surface/material detail — dropped in i2v (the reference supplies it).
  if (!i2v && lint.materials.length) {
    parts.push(`Tactile surface details highlighting ${lint.materials.join(", ")} with sharp edge separation and specular highlights`);
  }

  if (lint.rigidCollisions) {
    parts.push("ground contact shadows, authentic traction, rigid mechanical frame with zero clipping, natural mass inertia");
  }

  // Kinematic & physics precision — the core tuning for high-fidelity commercial
  // renders: real weight transfer and controlled continuous motion.
  parts.push(
    "Natural kinematic weight transfer with realistic mass inertia — suspension compression, tire and boot traction, grounded momentum; controlled continuous motion with no sudden speed snaps, flips, or exaggerated kicks",
  );

  // Compositional framing guardrail per aspect ratio.
  const aspect = state.aspectRatio ?? "16:9";
  if (aspect === "9:16") {
    parts.push("vertical 9:16 framing, subject centered, full ground-plane contact visible in the lower third with ample head/foot clearance");
  } else if (aspect === "1:1") {
    parts.push("square 1:1 composition, subject centered with even balanced margins");
  } else {
    parts.push("wide 16:9 widescreen composition with balanced horizontal negative space");
  }

  // Native resolution — inject a clarity cue only at 1080p (480p/720p unchanged).
  if (state.resolution === "1080p") {
    parts.push("mastered in crisp 1080p full high-definition clarity");
  }

  const colorProfile = state.cinemaKit?.colorScience || "graded commercial film LUT";
  const shutterSpeed = (state.guardrails.lockShutterSpeed ?? true)
    ? "24fps, strict 180-degree shutter angle, zero digital motion blur"
    : "24fps, real-time 1.0x velocity";
  parts.push(`${shutterSpeed}, ${colorProfile}, ${duration}-second continuous clip`);

  if (state.guardrails.suppressText) {
    parts.push("100% clean broadcast footage, zero on-screen text, no overlays, no floating logos");
  }
  if (state.guardrails.lockAnatomy) {
    parts.push("anatomically accurate joint pivots, forward-facing orientation throughout");
  }

  const positivePrompt = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(". ")
    .replace(/\s+/g, " ")
    .replace(/\.\./g, ".")
    .trim() + ".";

  const negativePrompt = [
    state.guardrails.suppressText ? "text, typography, letters, brand labels, misspelled words, floating logos, watermark, badges, UI elements" : null,
    state.guardrails.lockAnatomy ? "morphing limbs, extra legs, duplicate feet, backward-facing anatomy, snapping joints, mutated hands, extra fingers" : null,
    state.guardrails.enforcePhysics ? "martial arts high kick, floating vehicle, zero suspension compression, clipping through metal, rubbery physics, defying gravity, melting surfaces" : null,
    "sudden scale shifts, subject-scale hallucination, feet morphing into vehicle parts, uncontrolled zoom, inconsistent subject size, lens breathing",
    "sudden speed ramps, speed snapping, teleporting motion, backflip, front flip, exaggerated high kick, jerky acceleration, flailing limbs",
    "watermark, floating badges, on-screen typography, station logos, timecode overlays",
    "erratic motion blur, frame interpolation artifacts, stutter, low bitrate, blurry textures, AI plastic skin"
  ].filter(Boolean).join(", ");

  return { positivePrompt, negativePrompt, corrections: lint.corrections };
}

// Cinema-kit option lists for the UI (mirror the interface unions).
export const CAMERA_BODIES = [
  "ARRI Alexa Mini LF",
  "RED V-Raptor 8K",
  "Sony FX9",
  "35mm Cine Camera",
] as const;

export const LENS_PROFILES = [
  "Anamorphic 35mm Prime",
  "Cooke S4/i 50mm Prime",
  "90mm Macro Cine Prime",
] as const;

export const COLOR_SCIENCES = [
  "ARRI LogC3 / Kodak 2383 LUT",
  "Commercial High-Contrast Neutral",
] as const;

export type CameraBody = (typeof CAMERA_BODIES)[number];
export type LensProfile = (typeof LENS_PROFILES)[number];
export type ColorScience = (typeof COLOR_SCIENCES)[number];
