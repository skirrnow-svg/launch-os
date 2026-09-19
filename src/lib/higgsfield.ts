import { execFile } from "child_process";
import { promisify } from "util";
import { ConfirmationRequiredError } from "./errors";

const exec = promisify(execFile);

/**
 * Higgsfield AI generation — driven by the local `higgsfield` CLI.
 *
 * ⚠️ SPENDING GUARDRAILS (OWNER HARD RULE — do not remove, do not bypass)
 * ---------------------------------------------------------------------------
 * - Total monthly budget: 200 credits.
 * - NEVER run high-resolution video models (>25 credits) autonomously.
 * - ALWAYS output the estimated credit cost and WAIT for explicit human
 *   confirmation before calling ANY generation. Every generate() call must be
 *   `confirmed: true`; an unconfirmed call throws ConfirmationRequiredError
 *   carrying the real cost, so the caller can show it and ask.
 * ---------------------------------------------------------------------------
 *
 * Requires the `higgsfield` CLI installed + authenticated on the host (machine
 * auth, not a per-org key). NOTE: this runs where the CLI lives (local/dev, or
 * a job-runner) — NOT on Cloudflare Pages. In production, move generate() into
 * a worker with the CLI. Result media is the Higgsfield-hosted URL; mirroring
 * to R2 is a follow-up (see storeToR2 TODO).
 */

export type HiggsfieldKind = "image" | "video";

export interface GenerateParams {
  orgId: string;
  kind: HiggsfieldKind;
  prompt: string;
  /** Explicit job_set_type; defaults per kind. */
  model?: string;
  /** Must be true to actually spend — set only after human confirmation. */
  confirmed?: boolean;
  /** Higgsfield native video params (aligned to `higgsfield generate create`). */
  resolution?: "480p" | "720p" | "1080p";
  duration?: number; // seconds, 4-15
  aspectRatio?: "16:9" | "9:16" | "1:1";
  mode?: "t2v" | "i2v";
  /** Reference image path for Image-to-Video (mode "i2v"). */
  imagePath?: string;
}

/** Build the native CLI flags for a video job (empty for images). */
function videoFlags(p: GenerateParams): string[] {
  if (p.kind !== "video") return [];
  const flags: string[] = [];
  if (p.resolution) flags.push("--resolution", p.resolution);
  if (p.duration) flags.push("--duration", String(Math.min(15, Math.max(4, Math.round(p.duration)))));
  if (p.aspectRatio) flags.push("--aspect_ratio", p.aspectRatio);
  if (p.mode) flags.push("--mode", p.mode);
  if (p.mode === "i2v" && p.imagePath) flags.push("--image", p.imagePath);
  return flags;
}

/** Hard ceiling for anything that may run without a human in the loop. */
export const AUTONOMOUS_CREDIT_CEILING = 25;
const BIN = "higgsfield";

/** Default job_set_type per kind (quality-first defaults from the skill). */
export function modelFor(kind: HiggsfieldKind, override?: string): string {
  if (override) return override;
  return kind === "video" ? "seedance_2_0" : "gpt_image_2";
}

async function run(args: string[]): Promise<string> {
  const { stdout } = await exec(BIN, args, { maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  return stdout;
}

/** Whether the CLI is installed + authenticated (no spend). */
export async function higgsfieldConfigured(): Promise<boolean> {
  try {
    const out = await run(["account", "status"]);
    return /credits/i.test(out);
  } catch {
    return false;
  }
}

/** Remaining credits on the selected workspace, or null if unreadable. */
export async function getAccountCredits(): Promise<number | null> {
  try {
    const out = await run(["account", "status"]);
    const m = out.match(/([\d.]+)\s*credits/i);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** Real credit cost for a job (no generation). Throws if the CLI can't price it. */
export async function estimateCost(
  kind: HiggsfieldKind,
  prompt: string,
  model?: string,
): Promise<number> {
  const jst = modelFor(kind, model);
  const out = await run(["generate", "cost", jst, "--prompt", prompt]);
  const m = out.match(/([\d.]+)\s*credits?/i);
  if (!m) throw new Error(`Could not read cost from CLI: ${out.slice(0, 120)}`);
  return Number(m[1]);
}

export interface GenerateResult {
  url: string;
  storageKey: string;
  creditsUsed: number;
  model: string;
}

/**
 * Enforce the owner guardrail, then generate. An unconfirmed call NEVER spends —
 * it prices the job and throws ConfirmationRequiredError with the real cost.
 */
export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const jst = modelFor(params.kind, params.model);
  const flags = videoFlags(params);
  const cost = await estimateCost(params.kind, params.prompt, params.model);

  // Owner rule: confirm before ANY spend; video / >25-credit never autonomous.
  if (!params.confirmed) {
    const extra =
      params.kind === "video" || cost > AUTONOMOUS_CREDIT_CEILING
        ? ` (video / over ${AUTONOMOUS_CREDIT_CEILING} credits never runs without confirmation)`
        : "";
    throw new ConfirmationRequiredError(
      `Higgsfield ${params.kind} (${jst}) will cost ~${cost} credits${extra}.`,
      cost,
    );
  }

  // Budget safety: don't spend beyond the remaining balance.
  const remaining = await getAccountCredits();
  if (remaining != null && cost > remaining) {
    throw new Error(`Not enough credits: need ~${cost}, have ${remaining}.`);
  }

  const out = await run([
    "generate",
    "create",
    jst,
    "--prompt",
    params.prompt,
    ...flags,
    "--wait",
    "--json",
  ]);
  const url = extractMediaUrl(out);
  if (!url) throw new Error("Generation finished but no media URL was returned.");

  // TODO(follow-up): download `url` and mirror to Cloudflare R2 (storeToR2),
  // then use the R2 URL for durability. For now the Higgsfield URL is stored.
  return { url, storageKey: url, creditsUsed: cost, model: jst };
}

/** Deep-search the CLI's JSON for the first plausible media URL. */
function extractMediaUrl(stdout: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch {
    const m = stdout.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp|mp4|mov|webm|glb)/i);
    return m ? m[0] : null;
  }
  const preferred = ["result_url", "output_url", "media_url", "video_url", "image_url", "url"];
  let fallback: string | null = null;
  const seen = new Set<unknown>();
  const walk = (node: unknown): string | null => {
    if (node == null || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === "string" && /^https?:\/\//.test(v)) {
        if (preferred.includes(k.toLowerCase())) return v;
        if (!fallback && /\.(png|jpg|jpeg|webp|mp4|mov|webm|glb)/i.test(v)) fallback = v;
      } else if (v && typeof v === "object") {
        const found = walk(v);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(data) ?? fallback;
}
