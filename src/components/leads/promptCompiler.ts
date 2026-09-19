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
import { FRAMING_SCOPE, resolveScaleConflicts } from "./promptBuilderOptions";

export interface ProVideoPromptState {
  heroSubject: string;
  actors: string[];
  action: string;
  camera: string[];
  environments: string[];
  lighting: string[];
  materials: string[];
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

  // Split camera into framings vs movements, then resolve any scale/optical
  // conflict (macro framing + full-body action, or a mismatched lens).
  const framings = state.camera.filter((c) => c in FRAMING_SCOPE);
  const movements = state.camera.filter((c) => !(c in FRAMING_SCOPE));
  const effectiveLens = state.cinemaKit?.lensProfile || "Anamorphic 35mm Prime";
  const resolved = resolveScaleConflicts({ framings, action: state.action, lens: effectiveLens });
  const lens = resolved.lens;

  const cameraTerms = [...resolved.framings, ...movements].filter(Boolean);
  const framing = cameraTerms.length ? cameraTerms.join(", ") : "Cinematic commercial tracking shot";
  parts.push(`Captured on ${cameraRig} with ${lens}, ${framing} focused on ${state.heroSubject || "the hero subject"}`);

  if (state.actors.length) parts.push(`featuring ${state.actors.join(" and ")}`);

  const envLight: string[] = [];
  if (state.environments.length) envLight.push(`set in ${state.environments.join(", ")}`);
  if (state.lighting.length) envLight.push(`directional lighting via ${state.lighting.join(" and ")}`);
  if (envLight.length) parts.push(envLight.join(", "));

  if (state.action) parts.push(`Action: ${state.action}`);

  if (state.materials.length) {
    parts.push(`Tactile surface details highlighting ${state.materials.join(", ")} with sharp edge separation and specular highlights`);
  }

  if (state.guardrails.rigidCollisions ?? true) {
    parts.push("ground contact shadows, authentic traction, rigid mechanical frame with zero clipping, natural mass inertia");
  }

  const colorProfile = state.cinemaKit?.colorScience || "graded commercial film LUT";
  const shutterSpeed = (state.guardrails.lockShutterSpeed ?? true)
    ? "24fps, strict 180-degree shutter angle, zero digital motion blur"
    : "24fps, real-time 1.0x velocity";
  parts.push(`${shutterSpeed}, ${colorProfile}`);

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
    "erratic motion blur, frame interpolation artifacts, stutter, low bitrate, blurry textures, AI plastic skin"
  ].filter(Boolean).join(", ");

  return { positivePrompt, negativePrompt };
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
