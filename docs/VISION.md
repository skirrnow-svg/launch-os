# SkirrNow Launch OS — Product Vision (canonical)

_Owner: Dextor Colaco (dextor@idocs.in). Source of truth for positioning, architecture
intent, and the build roadmap. Read this instead of re-deriving the vision._

Last set: 2026-09-12 (god, from owner's vision brief).

---

## One-liner

SkirrNow Launch OS is a **multi-tenant, agentic AI marketing operating system** that
automates end-to-end digital marketing for **solo entrepreneurs, SMEs, enterprises, and
white-label digital agencies**. It coordinates specialized autonomous agents that plan,
produce, optimize, and distribute campaigns across **search, social, paid ads, and email**.

Grounded in the **Perceive → Reason → Act (PRA)** cycle and the **MAAI-CAMP** (Multi-Agent
AI Campaign Automation, Management and Performance) framing. Public copy uses plain operator
language, not the framework jargon.

## Core architecture — hub-and-spoke agent ecosystem

An **Orchestrator** interprets a high-level objective, holds global context, and delegates
to four specialists (reasoning loops + tool-calling):

| Agent | Job | Maps to today |
|---|---|---|
| **Orchestrator** | Interprets objectives, manages cross-agent context, delegates | Partially: the runner + job queue |
| **Customer Analytics & Audience** | SQL queries, RFM quintile segmentation, churn-risk scoring | **NEW** (inspired by open-source MarketingAgent) |
| **Creative & Multimodal** | Long-form copy + GEO structured schema (Claude); cinematic short-form video, viral hooks, character-consistent product animation (Higgsfield) | Partially: `claude` CLI copy + `higgsfield` CLI media |
| **Channel Execution** | Google Business Profile posts, social distribution, lifecycle email (Resend) | Partially: Resend delivery exists; GBP/social **NEW** |
| **Analytics & Reporting** | Ingest conversions, campaign-drift alerts, real-time white-label dashboards | **NEW** (metrics table is a stub today) |

## Multi-tier audiences

- **Solopreneurs & creators** — single-click campaign kit (social copy, UGC video concept,
  newsletter, email sequence) from a simple URL brief.
- **SMEs** — automated lifecycle marketing, local SEO/GBP posting, churn intervention,
  budget pacing.
- **Agencies & enterprises (white-label)** — multi-tenant org isolation, custom CNAME domain
  mapping (`marketing.agencybrand.com`), agency-branded PDF / client portals, per-client
  sub-account provisioning.

## The zero-cost "Viral Trojan Horse" trial — **as owner-scoped**

Free **Product-to-Ad Generator** as the top-of-funnel lead magnet. **Owner decisions
(2026-09-12) that override the generic brief:**

1. **It is gated LEAD-GEN, not anonymous.** Before anything generates, the visitor must
   provide a **valid email (verified)** AND a **phone number (OTP-verified)**. This captures a
   real lead and blocks bots.
2. **Flow:** paste website/Shopify URL → verify email + phone (OTP) → server scrapes the
   landing page → Claude writes **3 high-converting viral hooks** → an **AI Marketing Audit &
   Hook Report** → a **real Higgsfield animated teaser**.
3. **Teaser is auto-rendered per _verified_ visitor, hard-capped at ≤10 credits.** Cost is
   estimated first (`higgsfield generate cost`); if the chosen render would exceed 10 credits
   it is downgraded or refused — never silently overspent. The UI tells the user the teaser
   "can be improved with paid plans" (full-resolution, unwatermarked).
4. **Guardrails still absolute:** the 200-credit/month shared pool is the ceiling; the free
   generator draws from it, so it must have its own monthly budget guard (≈20 verified
   teasers/mo at 10 cr each before the pool is exhausted). NEVER autonomous >25-cr video.
5. **Viral growth loop:** to unlock the **full-resolution, unwatermarked** video and the
   automated email sequence, the user **refers another business owner** (referral link) OR
   **upgrades** to a paid tier.

## Guardrails (non-negotiable)

- Higgsfield: 200 credits/month hard ceiling; free teaser ≤10 cr/visitor, cost-estimated
  first; NEVER autonomous >25-cr video; the general rule (state cost + explicit yes before
  generation) is satisfied for the free teaser by the owner's standing ≤10-cr authorization.
- Secrets in git-ignored `.env.local`; never printed, never committed.
- No outbound send is automatic — human one-click approval gates delivery.

## Build roadmap (staged)

**Phase A — Reposition (DONE 2026-09-12, god):** marketing site rewritten to this vision
(agent ecosystem, PRA loop, three tiers, free Product-to-Ad generator lead in the hero);
this doc; board/tasks restructured. Dark Studio aesthetic retained.

**Phase B — Free Product-to-Ad Generator (lead-gen wedge):** public route → email verify +
phone OTP → URL scrape → 3 Claude hooks → AI Marketing Audit report → ≤10-cr Higgsfield
teaser (watermarked) → lead saved (`source='free-generator'`) → referral/upgrade upsell.
**Human-blocked on:** an SMS/OTP provider (India-appropriate, e.g. MSG91/Twilio) — account +
credentials + cost. Email verification can use Clerk or a magic-code.

**Phase C — the specialist agents as real capabilities:**
- Customer Analytics & Audience agent (RFM quintiles + churn scoring over org data).
- Channel Execution agent (Google Business Profile posting, social distribution).
- Analytics & Reporting agent (white-label executive dashboards, drift alerts).

**Phase D — White-label / agency:** custom CNAME domain mapping, agency-branded PDF reports
+ client portals, per-client sub-account provisioning.

**Phase E — Referral engine:** referral links, unlock-on-referral, upgrade gate (ties into
the Razorpay paid gate, SN25).

## Current build state (what already exists — do not rebuild)

Next.js 14.2.35 App Router on **Hostinger** (branch `hostinger-deploy`, temp URL
`darkslategrey-chicken-241243.hostingersite.com`). Multi-tenant Clerk orgs; Neon Postgres via
Prisma; per-org credit metering (`credit_cap`/`credits_used`, `lib/credits.ts`). Runner
(`runner/process-jobs.mjs`, GitHub Actions) claims queued assets and generates media via the
`higgsfield` CLI and copy via `claude -p` — **no metered API keys**. Resend outbound delivery
wired. Instant Pitch Generator (`/dashboard/pitch`, `source='pitch'`, copy-only) is the
precursor to the free generator. Razorpay plan catalog is account-agnostic + key-free
(`src/lib/billing/plans.ts`); the paid gate (SN25) is blocked on the owner's account decision.
