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
// Hard monthly Higgsfield quota across the whole shared pool (all tenants).
const MONTHLY_CREDIT_CAP = Number(process.env.HIGGSFIELD_MONTHLY_CAP || 200);

/** Total Higgsfield credits spent this cycle across every org (shared pool). */
async function globalCreditsUsed() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(credits_used), 0)::float8 AS used FROM organizations`,
  );
  return Number(rows?.[0]?.used ?? 0);
}

/** Loose E.164 validation: optional +, 8–15 digits. */
function isE164(phone) {
  if (typeof phone !== "string") return false;
  const compact = phone.replace(/[\s()\-.]/g, "");
  return /^\+?[1-9]\d{7,14}$/.test(compact);
}
function toE164(phone) {
  const compact = String(phone || "").replace(/[\s()\-.]/g, "");
  return compact.startsWith("+") ? compact : compact ? `+${compact}` : "";
}

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
    RETURNING a.id, a.type, a.prompt, a.metadata, p.org_id
  `);
  return rows[0] || null;
}

// ---- Copy generation (Claude, via `claude -p` on the subscription) ----------

function claude(prompt, system) {
  const full = system ? `${system}\n\n${prompt}` : prompt;
  try {
    return execFileSync("claude", ["-p", "--max-turns", "1", "--model", process.env.CLAUDE_CODE_MODEL || "sonnet"], {
      input: full,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    // Surface the real reason (auth, rate limit, model) instead of a bare
    // "Command failed", so runner logs are actually diagnosable.
    const detail = ((e && (e.stderr || e.stdout)) || "").toString().trim();
    throw new Error(`claude exit ${e && e.status}: ${detail ? detail.slice(0, 800) : e && e.message}`);
  }
}
function parseJsonish(text) {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { return null; }
}

// ---- Usage telemetry --------------------------------------------------------
// Estimate Claude tokens (~4 chars/token) since the CLI returns plain text.
function estTokens(...parts) {
  const c = parts.reduce((n, p) => n + (typeof p === "string" ? p.length : 0), 0);
  return Math.max(1, Math.ceil(c / 4));
}
// Log one usage_events row; for Claude also increment the org's token counter.
// Best-effort — telemetry must never fail a generation job.
async function recordUsage(orgId, e) {
  if (!orgId) return;
  try {
    const tokens = Number.isFinite(e.tokens) ? Math.max(0, Math.round(e.tokens)) : 0;
    const credits = Number.isFinite(e.credits) ? Number(e.credits) : 0;
    await prisma.usage_events.create({
      data: {
        org_id: orgId, provider: e.provider, kind: e.kind, model: e.model ?? null,
        credits, tokens: BigInt(tokens), estimated: !!e.estimated, status: e.status || "ok",
        ref_type: e.refType ?? null, ref_id: e.refId ?? null,
      },
    });
    if (e.provider === "claude" && tokens > 0) {
      await prisma.organizations.update({ where: { id: orgId }, data: { claude_tokens_used: { increment: BigInt(tokens) } } });
    }
  } catch (err) {
    console.error("[runner] usage record failed:", err?.message || err);
  }
}

// Record provider auth health (singleton platform_settings row) each run, so
// the local secret-sync task can email the owner when either provider is down.
async function recordAuthStatus(claudeOk, hfOk) {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE platform_settings SET claude_auth_ok=$1, higgsfield_auth_ok=$2, auth_checked_at=now()`,
      claudeOk, hfOk,
    );
  } catch (e) {
    console.error("[runner] auth status write failed:", e?.message || e);
  }
}

async function claimCampaign() {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE email_campaigns SET status='generating', updated_at=now()
    WHERE id = (
      SELECT id FROM email_campaigns
      WHERE status='queued' AND generation_brief IS NOT NULL
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING id, name, subject, generation_brief,
      (SELECT p.org_id FROM projects p WHERE p.id = email_campaigns.project_id) AS org_id
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
  await recordUsage(c.org_id, {
    provider: "claude", kind: "email", model: process.env.CLAUDE_CODE_MODEL || "sonnet",
    tokens: estTokens(c.generation_brief, out), estimated: true, refType: "email_campaign", refId: c.id,
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
    ) RETURNING id, content, generation_brief,
      (SELECT p.org_id FROM projects p WHERE p.id = social_posts.project_id) AS org_id
  `);
  return rows[0] || null;
}
async function processPost(p) {
  const out = claude(
    p.generation_brief,
    'You are a senior social copywriter. Return ONLY JSON {"content": string, "hashtags": string[]} — punchy on-brand copy plus 3-6 hashtags (no # prefix).',
  );
  const parsed = parseJsonish(out) || {};
  await recordUsage(p.org_id, {
    provider: "claude", kind: "social", model: process.env.CLAUDE_CODE_MODEL || "sonnet",
    tokens: estTokens(p.generation_brief, out), estimated: true, refType: "social_post", refId: p.id,
  });
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

// ---- Landing / web pages (Claude → self-contained responsive HTML) ----------
async function claimLandingPage() {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE landing_pages SET status='generating', updated_at=now()
    WHERE id = (
      SELECT id FROM landing_pages
      WHERE status='queued'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING id, org_id, title, brief
  `);
  return rows[0] || null;
}
function extractHtml(text) {
  const t = String(text || "").trim().replace(/^```(?:html)?/i, "").replace(/```$/, "").trim();
  const lower = t.toLowerCase();
  const doctype = lower.indexOf("<!doctype");
  const start = doctype >= 0 ? doctype : lower.indexOf("<html");
  const end = lower.lastIndexOf("</html>");
  if (start >= 0 && end >= 0) return t.slice(start, end + 7);
  return t;
}
async function processLandingPage(lp) {
  const brief = (lp.brief || "").trim();
  const prompt = `Landing page title: ${lp.title}\n\n${brief ? `Brief:\n${brief}` : "No extra brief — infer a compelling, conversion-focused page from the title."}`;
  const out = claude(
    prompt,
    "You are an expert conversion copywriter and front-end designer. Produce a COMPLETE, self-contained, responsive HTML5 landing page as a single file. Requirements: one <!DOCTYPE html> document; ALL CSS in a <style> tag (no external stylesheets, fonts, scripts or images — use CSS gradients/shapes, inline SVG or emoji instead); semantic, accessible, mobile-first; a hero with headline + subhead + primary CTA, a few benefit/feature sections, a social-proof placeholder, and a footer. Modern, clean, high-contrast. Return ONLY the HTML — no markdown fences, no commentary.",
  );
  const html = extractHtml(out);
  if (!html || html.length < 80) throw new Error("Landing page generation returned no usable HTML.");
  await prisma.landing_pages.update({
    where: { id: lp.id },
    data: { status: "ready", html, error: null, updated_at: new Date() },
  });
  await recordUsage(lp.org_id, {
    provider: "claude", kind: "website", model: process.env.CLAUDE_CODE_MODEL || "sonnet",
    tokens: estTokens(prompt, out), estimated: true, refType: "landing_page", refId: lp.id,
  });
  console.log(`[runner] landing page ${lp.id} ready (${html.length} bytes)`);
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

  const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
  const isSample = meta.sample === true;
  // Sample concept videos render in draft: fast mode, 480p, 4s, no audio —
  // the cheapest way to preview a concept and stay inside the quota.
  const draftArgs =
    isSample && asset.type === "video"
      ? ["--mode", "fast", "--resolution", "480p", "--duration", "4", "--generate-audio", "false"]
      : [];

  const cost = parseCredits(hf(["generate", "cost", jst, "--prompt", prompt, ...draftArgs]));

  // Hard monthly Higgsfield quota across the whole shared pool.
  const globalUsed = await globalCreditsUsed();
  if (Number.isFinite(cost) && globalUsed + cost > MONTHLY_CREDIT_CAP) {
    const msg = `BUDGET_CAP_EXCEEDED: global ${globalUsed}+~${cost} cr > ${MONTHLY_CREDIT_CAP} cap`;
    if (isSample) {
      // Sample pipeline: never fail the lead — keep the copy, skip the render.
      await prisma.assets.update({
        where: { id: asset.id },
        data: { status: "draft", error_message: "BUDGET_CAP_EXCEEDED", metadata: { ...meta, budgetCapExceeded: true } },
      });
      console.error(`[runner] ${msg} — asset ${asset.id} kept as draft copy only.`);
      return;
    }
    throw new Error(msg);
  }

  const remaining = accountCredits();
  if (Number.isFinite(cost) && remaining != null && cost > remaining) {
    throw new Error(`Not enough credits: need ~${cost}, have ${remaining}.`);
  }
  // Per-org budget (multi-tenant fix #1).
  const orgRemaining = await remainingOrgCredits(asset.org_id);
  if (orgRemaining != null && Number.isFinite(cost) && cost > orgRemaining) {
    throw new Error(`Workspace budget: need ~${cost}, ${orgRemaining} left.`);
  }
  if (asset.type === "video" && !isSample && Number.isFinite(cost) && cost > AUTONOMOUS_CREDIT_CEILING) {
    // Was confirmed by a human at enqueue; log for the audit trail.
    console.log(`[runner] video job ${asset.id} ~${cost} cr (human-confirmed at enqueue)`);
  }

  const out = hf(["generate", "create", jst, "--prompt", prompt, ...draftArgs, "--wait", "--json"]);
  const url = extractMediaUrl(out);
  if (!url) throw new Error("Generation finished but no media URL returned.");

  await prisma.assets.update({
    where: { id: asset.id },
    data: {
      url,
      storage_key: url, // TODO: mirror to Cloudflare R2, then store the R2 key
      status: "ready",
      metadata: { ...meta, model: jst, creditsUsed: Number.isFinite(cost) ? cost : null },
    },
  });
  if (Number.isFinite(cost) && cost > 0) {
    await prisma.organizations.update({
      where: { id: asset.org_id },
      data: { credits_used: { increment: cost } },
    });
  }
  await recordUsage(asset.org_id, {
    provider: "higgsfield", kind: asset.type || "media", model: jst,
    credits: Number.isFinite(cost) ? cost : 0, refType: "asset", refId: asset.id,
  });
  console.log(`[runner] ready ${asset.id} (${jst}, ~${cost} cr) → ${url}`);
}

// ---- Lead qualification (Phase 3 + 4) ---------------------------------------

const str = (v) => (typeof v === "string" ? v.trim() : "");
function slugify(input) {
  return (
    String(input || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

/** Atomically claim one PENDING interested lead. */
async function claimLead() {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE leads SET status='PROCESSING'
    WHERE id = (
      SELECT id FROM leads
      WHERE status='PENDING' AND intent_status='INTERESTED'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING id, org_id, email, raw_body, source, auto_video, verification
  `);
  return rows[0] || null;
}

/** The org's creating user — used as created_by on auto-provisioned rows. */
async function orgActingUser(orgId) {
  const org = await prisma.organizations.findUnique({ where: { id: orgId }, select: { created_by: true } });
  if (!org) throw new Error(`org ${orgId} not found`);
  return org.created_by;
}

/** Find or create a per-org "Intake" project to host clarification drafts. */
async function getIntakeProject(orgId, actingUser) {
  const slug = "intake";
  const existing = await prisma.projects.findFirst({ where: { org_id: orgId, slug, deleted_at: null } });
  if (existing) return existing;
  return prisma.projects.create({
    data: { org_id: orgId, name: "Intake", slug, description: "Inbound lead clarifications", status: "draft", created_by: actingUser },
  });
}

async function enqueueSampleEmail(projectId, actingUser, ctx) {
  await prisma.email_campaigns.create({
    data: {
      project_id: projectId,
      created_by: actingUser,
      name: `Cold outreach — ${ctx.company_name}`,
      subject: "(to be generated)",
      from_name: "SkirrNow",
      from_email: "launch@skirrnow.app",
      template_html: "<div>pending</div>",
      status: "queued",
      generation_brief: `Write a concise cold-outreach FOLLOW-UP email to ${ctx.company_name} (${ctx.metro_area}), a ${ctx.niche} business. Core offer: ${ctx.core_offer}. Warm, specific, credible, one clear CTA to view free sample creative we made for them. No fabricated guarantees or pricing.`,
    },
  });
}

async function enqueueSampleVideo(projectId, actingUser, ctx) {
  const script = parseJsonish(
    claude(
      `Company: ${ctx.company_name}. Metro: ${ctx.metro_area}. Niche: ${ctx.niche}. Offer: ${ctx.core_offer}.`,
      'You are a short-form video ad director. Return ONLY JSON {"hook": string, "script": string, "visual_prompt": string} — a scroll-stopping 1-line hook, a ~4-second script, and a concise visual prompt for an AI concept video (no on-screen text, no unverifiable claims).',
    ),
  ) || {};
  const visual = str(script.visual_prompt) || `${ctx.niche} concept ad for ${ctx.company_name}, ${ctx.metro_area}, cinematic`;
  await prisma.assets.create({
    data: {
      project_id: projectId,
      created_by: actingUser,
      type: "video",
      name: `Concept ad — ${ctx.company_name}`,
      prompt: visual,
      status: "queued",
      metadata: { sample: true, hook: str(script.hook), script: str(script.script), requested: { mode: "fast", resolution: "480p", duration: 4 } },
    },
  });
}

/** Coerce anything into an array of trimmed non-empty strings, capped. */
function strList(v, cap) {
  if (!Array.isArray(v)) return [];
  const out = v.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  return cap ? out.slice(0, cap) : out;
}

/**
 * Free Product-to-Ad generator: the lead's raw_body already holds the scraped
 * website content (the web tier fetched it). We produce 3 viral hooks + an AI
 * marketing audit — TEXT ONLY, 0 credits — and store it on the lead's
 * verification JSON, which the public report page polls. The animated teaser is
 * intentionally NOT rendered here: it stays behind the phone-verified gate so
 * the free path never auto-spends Higgsfield credits (see docs/VISION.md).
 */
async function processFreeReport(lead) {
  const out = claude(
    lead.raw_body,
    'You are a senior direct-response marketing strategist auditing a business from its website content. ' +
      'Return ONLY JSON with this exact shape: ' +
      '{"business":{"name":string,"what":string},' +
      '"hooks":[string,string,string],' +
      '"audit":{"headline":string,"summary":string,"strengths":string[],"gaps":string[],"recommendations":string[]}}. ' +
      'hooks = 3 scroll-stopping, high-converting ad hooks (<=90 chars each, no emojis, no quotes). ' +
      'audit.summary = 2-3 sentences. strengths/gaps/recommendations = 2-4 short, specific, actionable bullets each. ' +
      'Be concrete and grounded in the actual content; never fabricate metrics, guarantees, or pricing. No prose outside the JSON.',
  );
  const parsed = parseJsonish(out) || {};
  const biz = parsed.business && typeof parsed.business === "object" ? parsed.business : {};
  const audit = parsed.audit && typeof parsed.audit === "object" ? parsed.audit : {};

  const free_report = {
    business: { name: str(biz.name), what: str(biz.what) },
    hooks: strList(parsed.hooks, 3),
    audit: {
      headline: str(audit.headline),
      summary: str(audit.summary),
      strengths: strList(audit.strengths, 4),
      gaps: strList(audit.gaps, 4),
      recommendations: strList(audit.recommendations, 4),
    },
  };

  if (free_report.hooks.length === 0 && !free_report.audit.summary) {
    throw new Error("Audit generation returned nothing usable.");
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "QUALIFIED", verification: { free_report, audited_at: new Date().toISOString() } },
  });
  await recordUsage(lead.org_id, {
    provider: "claude", kind: "audit", model: process.env.CLAUDE_CODE_MODEL || "sonnet",
    tokens: estTokens(lead.raw_body, out), estimated: true, refType: "lead", refId: lead.id,
  });
  console.log(`[runner] free-generator lead ${lead.id} report ready (${free_report.hooks.length} hooks).`);
}

async function processLead(lead) {
  // Free Product-to-Ad generator leads take a separate, copy-only path.
  if (lead.source === "free-generator") {
    await processFreeReport(lead);
    return;
  }

  // 1) Extraction (claude -p → structured JSON).
  const ex = parseJsonish(
    claude(
      lead.raw_body,
      'You extract a business profile from an inbound email. Return ONLY JSON {"company_name": string, "metro_area": string, "phone": string, "niche": string, "core_offer": string}. Use "" for anything not stated.',
    ),
  ) || {};
  const company_name = str(ex.company_name);
  const metro_area = str(ex.metro_area);
  const niche = str(ex.niche) || "General";
  const core_offer = str(ex.core_offer);
  const phoneRaw = str(ex.phone);
  const phoneE164 = phoneRaw ? toE164(phoneRaw) : "";
  const phoneValid = phoneRaw ? isE164(phoneE164) : null; // null = not provided

  // 2) Data verification (business presence + metro consistency).
  const vr = parseJsonish(
    claude(
      JSON.stringify({ company_name, metro_area, core_offer }),
      'You are a business-data verifier. Judge plausibility only. Return ONLY JSON {"business_plausible": boolean, "metro_consistent": boolean, "notes": string}.',
    ),
  ) || {};
  const business_plausible = vr.business_plausible !== false;
  const metro_consistent = vr.metro_consistent !== false;

  // 3) Legal / compliance risk check (secondary claude prompt). Only run it
  // when there's a real offer — an empty offer is a missing-info case, not a
  // legal violation, so we must not reject on it.
  const lr = core_offer
    ? parseJsonish(
        claude(
          `Proposed offer for ${company_name} (${niche}): ${core_offer}`,
          'You are a consumer-protection compliance reviewer for ad claims. Flag deceptive or unsubstantiated claims (e.g. false long-term warranties, "$0" / free-with-strings pricing, guaranteed results). Return ONLY JSON {"legal_safe": boolean, "legal_issues": string[]}.',
        ),
      ) || {}
    : { legal_safe: true, legal_issues: [] };
  const legal_safe = lr.legal_safe !== false;
  const legal_issues = Array.isArray(lr.legal_issues) ? lr.legal_issues.filter((x) => typeof x === "string") : [];

  const missing = [];
  if (!company_name) missing.push("company_name");
  if (!metro_area) missing.push("metro_area");
  if (!core_offer) missing.push("core_offer");
  if (phoneValid === false) missing.push("valid_phone");

  // Plain-English explanation of why a lead needs info — surfaced in the UI so
  // the operator knows exactly what to add. Covers both missing fields AND the
  // AI plausibility / location checks (which have no "missing" field).
  const needs_info_reason = [];
  if (!company_name) needs_info_reason.push("a company or brand name");
  if (!core_offer) needs_info_reason.push("a clearer description of the product or offer");
  if (!metro_area) needs_info_reason.push("the city or metro area being targeted");
  if (phoneValid === false) needs_info_reason.push("a valid contact phone number");
  if (business_plausible === false) needs_info_reason.push("more detail — the business/offer wasn't specific enough to verify");
  if (metro_consistent === false) needs_info_reason.push("confirmation of the location — it didn't clearly line up with the business details");

  const verification = {
    extracted: { company_name, metro_area, niche, core_offer },
    phone: { value: phoneE164, e164_valid: phoneValid },
    business_plausible,
    metro_consistent,
    legal_safe,
    legal_issues,
    missing,
    needs_info_reason,
    audited_at: new Date().toISOString(),
  };

  const actingUser = await orgActingUser(lead.org_id);

  // Decision — incomplete/ambiguous first (never legal-reject on missing
  // data), then a genuine legal violation, else qualify.
  // An operator "approve anyway" (verification.force_qualify) overrides the soft
  // AI checks (plausibility / location) but never bypasses genuinely missing
  // core fields or the legal review.
  const forced = lead.verification && lead.verification.force_qualify === true;
  if (missing.length > 0 || (!forced && (!business_plausible || !metro_consistent))) {
    // Incomplete / ambiguous → intake clarification draft into the email queue.
    const intake = await getIntakeProject(lead.org_id, actingUser);
    await prisma.email_campaigns.create({
      data: {
        project_id: intake.id,
        created_by: actingUser,
        name: `Intake clarification — ${company_name || lead.email}`,
        subject: "(to be generated)",
        from_name: "SkirrNow",
        from_email: "launch@skirrnow.app",
        template_html: "<div>pending</div>",
        status: "queued",
        generation_brief: `Write a short, friendly clarification email to a prospect (${lead.email}) whose intake was incomplete/ambiguous. Politely request: ${needs_info_reason.join("; ") || "confirmation of their business details, metro area, and offer"}. Keep it brief with one clear reply CTA. No claims or pricing.`,
      },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "NEEDS_INFO", verification } });
    console.log(`[runner] lead ${lead.id} NEEDS_INFO (needs: ${needs_info_reason.join("; ") || "plausibility"}) — clarification drafted.`);
    return;
  }

  if (!legal_safe) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "REJECTED", verification } });
    console.log(`[runner] lead ${lead.id} REJECTED (legal): ${legal_issues.join("; ")}`);
    return;
  }

  // QUALIFIED → provision Project + ClientProfile, link the lead, enqueue samples.
  const project = await prisma.projects.create({
    data: {
      org_id: lead.org_id,
      name: company_name,
      slug: `${slugify(company_name)}-${Date.now().toString(36)}`,
      description: `Auto-provisioned from qualified lead ${lead.email}`,
      status: "live",
      created_by: actingUser,
    },
  });
  const profile = await prisma.clientProfile.create({
    data: {
      org_id: lead.org_id,
      company_name,
      metro_area,
      phone: phoneE164 || null,
      niche,
      project_id: project.id,
    },
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "QUALIFIED", verification, client_profile_id: profile.id },
  });

  const ctx = { company_name, metro_area, niche, core_offer };
  await enqueueSampleEmail(project.id, actingUser, ctx);
  // Concept video (~6 credits) is auto-generated for inbound leads, but for a
  // pitch (auto_video=false) it's left as an explicit, cost-previewed action so
  // the operator only spends credits on pitches worth rendering.
  if (lead.auto_video !== false) {
    await enqueueSampleVideo(project.id, actingUser, ctx);
  }
  console.log(
    `[runner] lead ${lead.id} QUALIFIED → project ${project.id}, profile ${profile.id}; ` +
      `email enqueued${lead.auto_video === false ? " (pitch: video on-demand)" : " + video enqueued"}.`,
  );
}

async function main() {
  let processed = 0;

  // Auth preflight results from the workflow (unset for local runs → treat as up).
  const hfDown = process.env.HF_AUTH_OK === "false";
  const claudeDown = process.env.CLAUDE_AUTH_OK === "false";
  await recordAuthStatus(!claudeDown, !hfDown);
  if (claudeDown) console.warn("[runner] Claude auth is down — skipping copy jobs (leads/email/social/landing left queued for re-auth).");

  // 0) Lead qualification (extraction → verify → legal → provision → samples).
  while (!claudeDown && processed < MAX_JOBS) {
    const lead = await claimLead();
    if (!lead) break;
    try {
      await processLead(lead);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "ERROR", verification: { error: message, at: new Date().toISOString() } },
      });
      console.error(`[runner] lead ${lead.id} error: ${message}`);
    }
    processed += 1;
  }

  // 1) Media assets (Higgsfield). Skipped when preflight found auth down, so
  // queued assets wait for re-auth instead of thrashing to `error` every run.
  if (hfDown) console.warn("[runner] Higgsfield auth is down — skipping media assets (left queued for re-auth).");
  while (!hfDown && processed < MAX_JOBS) {
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
  while (!claudeDown && processed < MAX_JOBS) {
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
  while (!claudeDown && processed < MAX_JOBS) {
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

  // 4) Landing / web pages (Claude → self-contained HTML).
  while (!claudeDown && processed < MAX_JOBS) {
    const lp = await claimLandingPage();
    if (!lp) break;
    try {
      await processLandingPage(lp);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.landing_pages.update({ where: { id: lp.id }, data: { status: "error", error: message, updated_at: new Date() } });
      console.error(`[runner] landing page ${lp.id} error: ${message}`);
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
