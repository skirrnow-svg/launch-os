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
    UPDATE assets a SET status='generating', updated_at=now()
    FROM projects p
    WHERE a.id = (
      SELECT id FROM assets
      WHERE status='queued' AND type IN ('image','video')
      ORDER BY created_at ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    ) AND p.id = a.project_id
    RETURNING a.id, a.type, a.prompt, p.org_id
  `);
  return rows[0] || null;
}

// ---- Copy generation (Claude, via `claude -p` on the subscription) ----------

function claude(prompt, system) {
  const full = system ? `${system}\n\n${prompt}` : prompt;
  return execFileSync("claude", ["-p", "--max-turns", "1", "--model", process.env.CLAUDE_CODE_MODEL || "sonnet"], {
    input: full,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}
function parseJsonish(text) {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { return null; }
}

async function claimCampaign() {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE email_campaigns SET status='generating', updated_at=now()
    WHERE id = (
      SELECT id FROM email_campaigns
      WHERE status='queued' AND generation_brief IS NOT NULL
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING id, name, subject, generation_brief
  `);
  return rows[0] || null;
}
async function processCampaign(c) {
  const out = claude(
    c.generation_brief,
    'You are a senior launch email copywriter. Return ONLY JSON {"subject": string, "html": string} — a compelling subject and a complete inline-friendly HTML email body (no <html>/<head> wrapper). No prose outside the JSON.',
  );
  const parsed = parseJsonish(out) || {};
  await prisma.email_campaigns.update({
    where: { id: c.id },
    data: {
      subject: typeof parsed.subject === "string" ? parsed.subject : c.subject,
      template_html: typeof parsed.html === "string" ? parsed.html : `<div>${out.trim()}</div>`,
      status: "draft",
      generation_brief: null,
    },
  });
  console.log(`[runner] campaign ${c.id} copy ready`);
}

async function claimPost() {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE social_posts SET status='generating', updated_at=now()
    WHERE id = (
      SELECT id FROM social_posts
      WHERE status='queued' AND generation_brief IS NOT NULL
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING id, content, generation_brief
  `);
  return rows[0] || null;
}
async function processPost(p) {
  const out = claude(
    p.generation_brief,
    'You are a senior social copywriter. Return ONLY JSON {"content": string, "hashtags": string[]} — punchy on-brand copy plus 3-6 hashtags (no # prefix).',
  );
  const parsed = parseJsonish(out) || {};
  await prisma.social_posts.update({
    where: { id: p.id },
    data: {
      content: typeof parsed.content === "string" ? parsed.content : out.trim(),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h) => typeof h === "string").map((h) => h.replace(/^#/, "")) : [],
      status: "draft",
      generation_brief: null,
    },
  });
  console.log(`[runner] post ${p.id} copy ready`);
}

/** Per-org budget: returns remaining credits, or null for unlimited. */
async function remainingOrgCredits(orgId) {
  const org = await prisma.organizations.findUnique({
    where: { id: orgId },
    select: { credit_cap: true, credits_used: true },
  });
  if (!org || org.credit_cap == null) return null;
  return Math.max(0, org.credit_cap - Number(org.credits_used ?? 0));
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
  // Per-org budget (multi-tenant fix #1).
  const orgRemaining = await remainingOrgCredits(asset.org_id);
  if (orgRemaining != null && Number.isFinite(cost) && cost > orgRemaining) {
    throw new Error(`Workspace budget: need ~${cost}, ${orgRemaining} left.`);
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
  if (Number.isFinite(cost) && cost > 0) {
    await prisma.organizations.update({
      where: { id: asset.org_id },
      data: { credits_used: { increment: cost } },
    });
  }
  console.log(`[runner] ready ${asset.id} (${jst}, ~${cost} cr) → ${url}`);
}

async function main() {
  let processed = 0;

  // 1) Media assets (Higgsfield).
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

  // 2) Email copy (Claude).
  while (processed < MAX_JOBS) {
    const c = await claimCampaign();
    if (!c) break;
    try {
      await processCampaign(c);
    } catch (e) {
      await prisma.email_campaigns.update({ where: { id: c.id }, data: { status: "draft", generation_brief: null } });
      console.error(`[runner] campaign ${c.id} error: ${e instanceof Error ? e.message : e}`);
    }
    processed += 1;
  }

  // 3) Social copy (Claude).
  while (processed < MAX_JOBS) {
    const p = await claimPost();
    if (!p) break;
    try {
      await processPost(p);
    } catch (e) {
      await prisma.social_posts.update({ where: { id: p.id }, data: { status: "draft", generation_brief: null } });
      console.error(`[runner] post ${p.id} error: ${e instanceof Error ? e.message : e}`);
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
