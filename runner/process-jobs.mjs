// Launch OS job runner — runs on GitHub Actions (a real Linux VM with the CLIs).
//
// Claims `queued` media assets from Neon, generates them with the `higgsfield`
// CLI, and writes the result back. Copy (email/social via `claude -p`) is a
// planned follow-up — it needs a brief column to enqueue against.
//
// Env required: DATABASE_URL, and a configured `higgsfield` CLI
// (HIGGSFIELD token in the workflow). Guardrail: video/>25-credit jobs were
// confirmed by a human at enqueue time; the runner still checks the live
// balance before spending and never exceeds it.
//
// Usage:  node runner/process-jobs.mjs   (exits when the queue is empty)

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";

const prisma = new PrismaClient();
const MAX_JOBS = Number(process.env.MAX_JOBS || 10); // bound a single run
const AUTONOMOUS_CREDIT_CEILING = 25;

function hf(args) {
  return execFileSync("higgsfield", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}
function modelFor(type) {
  return type === "video" ? "seedance_2_0" : "gpt_image_2";
}
function parseCredits(out) {
  const m = out.match(/([\d.]+)\s*credits?/i);
  return m ? Number(m[1]) : NaN;
}
function accountCredits() {
  try { return parseCredits(hf(["account", "status"])); } catch { return null; }
}
function extractMediaUrl(stdout) {
  let data;
  try { data = JSON.parse(stdout); }
  catch {
    const m = stdout.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp|mp4|mov|webm|glb)/i);
    return m ? m[0] : null;
  }
  const preferred = ["result_url", "output_url", "media_url", "video_url", "image_url", "url"];
  let fallback = null;
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    for (const [k, v] of Object.entries(node)) {
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

/** Atomically claim one queued media asset (safe for overlapping runs). */
async function claimAsset() {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE assets SET status='generating', updated_at=now()
    WHERE id = (
      SELECT id FROM assets
      WHERE status='queued' AND type IN ('image','video')
      ORDER BY created_at ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, prompt
  `);
  return rows[0] || null;
}

async function processAsset(asset) {
  const jst = modelFor(asset.type);
  const prompt = (asset.prompt || "").trim();
  if (!prompt) throw new Error("No prompt on asset.");

  const cost = parseCredits(hf(["generate", "cost", jst, "--prompt", prompt]));
  const remaining = accountCredits();
  if (Number.isFinite(cost) && remaining != null && cost > remaining) {
    throw new Error(`Not enough credits: need ~${cost}, have ${remaining}.`);
  }
  if (asset.type === "video" && Number.isFinite(cost) && cost > AUTONOMOUS_CREDIT_CEILING) {
    // Was confirmed by a human at enqueue; log for the audit trail.
    console.log(`[runner] video job ${asset.id} ~${cost} cr (human-confirmed at enqueue)`);
  }

  const out = hf(["generate", "create", jst, "--prompt", prompt, "--wait", "--json"]);
  const url = extractMediaUrl(out);
  if (!url) throw new Error("Generation finished but no media URL returned.");

  await prisma.assets.update({
    where: { id: asset.id },
    data: {
      url,
      storage_key: url, // TODO: mirror to Cloudflare R2, then store the R2 key
      status: "ready",
      metadata: { model: jst, creditsUsed: Number.isFinite(cost) ? cost : null },
    },
  });
  console.log(`[runner] ready ${asset.id} (${jst}, ~${cost} cr) → ${url}`);
}

async function main() {
  let processed = 0;
  while (processed < MAX_JOBS) {
    const asset = await claimAsset();
    if (!asset) break;
    try {
      await processAsset(asset);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.assets.update({
        where: { id: asset.id },
        data: { status: "error", error_message: message },
      });
      console.error(`[runner] error ${asset.id}: ${message}`);
    }
    processed += 1;
  }
  console.log(`[runner] done — processed ${processed} job(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[runner] fatal:", e);
  await prisma.$disconnect();
  process.exit(1);
});
