# Module 1 — AI Presence Kit (build contract)

Status: **in progress** (SN82). Branch: `feat/presence-kit`. Owner-approved 2026-10-04.

## Goal
One button. Input a business → output a live landing page + social graphics +
2–3 short videos + a Google review-request flow. The wedge the channel
(debugcentral hosting base + DC Automation resellers) can sell next.

## Stack decision
Built on the **current stack** (Next 14, Clerk, Prisma/Neon, Higgsfield via the
GitHub Actions runner, Claude, Resend, ffmpeg.wasm, Hostinger). The
Runware/fal.ai + R2 migration is a **later** phase — generation sits behind a
thin adapter (`src/lib/generation/adapter.ts`) so that swap is drop-in and adds
no new fixed-fee dependency now.

## Data model
Reuse the existing marketing model; add only what's genuinely new.
- **Business** = existing `ClientProfile` (company_name, metro_area, phone,
  niche, brand_guidelines) on a `projects` row. No new `businesses` table.
- **Landing page** = existing `landing_pages` (Claude-generated HTML).
- **Graphics + video** = existing `assets` (URL + metadata) via the runner.
- **NET-NEW `presence_kits`** — tracks one kit job: business inputs, status
  (`queued|generating|ready|partial|error`), and the ids of its landing page +
  assets.
- **NET-NEW `review_requests`** — a Google review ask to a customer; email-only
  now (Resend), `channel` leaves room for WhatsApp after DLT/BSP (SN83).

Tenancy by `org_id` column + index (same additive pattern as `visits`; no
Prisma relation). Migration: `prisma/migrations_manual/2026-10-04_presence_kit.sql`
(additive `CREATE TABLE/INDEX IF NOT EXISTS`). Mirror `schema.prisma` to `main`.

## Flow
1. Signed-in user (Clerk org = tenant) submits the business form (name,
   category, location, contacts, a few photos).
2. Persist: ClientProfile + project + a `presence_kits` row (job state).
3. Dispatch **one** job to the runner (not in-request); confirm-before-spend
   against the per-org budget; honor the 200-credit cap (fail-safe: queue/skip).
4. Runner: Claude copy + Higgsfield graphics/video; media stored **by URL only**
   (no infra storage until R2/SN81); text/metadata in Neon.
5. Landing page renders from the stored schema + referenced media; the
   review-request flow is wired to Resend.

## Acceptance criteria
- End-to-end: form → live, mobile-responsive page on the Hostinger site.
- Generation on the runner, within the 200-credit cap; no in-request generation;
  media by URL.
- `tsc --noEmit` + ESLint clean (unused vars / unescaped entities fail the
  build); Vitest on the new models + flow; CI green.
- No secrets client-side; generation keys stay on the runner.
- Every new row scoped to the Clerk org (tenant isolation).

## Out of scope for M1
Live Razorpay (SN25), R2 (SN81), WhatsApp/SMS, CRM pipelines, the
free-shell/credit-billing model, Booking (net-new, later).

## Risk guardrails (from the GTM playbook)
- Video stays **server-side** (Higgsfield/runner), not ffmpeg.wasm client
  assembly — in-browser video is unreliable on the low-end mobile devices of the
  target market. Brand Studio overlay stays a separate optional feature.
- **ViralMint is AGPL-3.0** — not used here; if ever adopted for video it must be
  isolated/BYOK with legal sign-off.
- Messaging compliance (India DLT + WhatsApp BSP) is tracked as **SN83** and must
  start before Module 2 messaging features.

## Build increments
1. ✅ Data model (`presence_kits`, `review_requests`) + generation adapter seam.
2. Orchestration route `POST /api/presence-kit` (create project/ClientProfile +
   landing page + asset rows, confirm-before-spend, trigger runner once).
3. Business form + kit status/results page.
4. Review-request flow (create + Resend send + click-token tracking).
5. Tests + CI + deploy via `hostinger-deploy`.
