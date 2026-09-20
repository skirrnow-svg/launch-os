# Phase-2 Backlog

Deferred work with enough context to pick up later. Each item notes *why it's
parked* and *what "done" looks like*. Several `TODO(phase-2)` markers exist in
the code (`src/lib/r2.ts`, `src/lib/buffer.ts`, etc.) — this is the human-readable
index of the important ones.

---

## Media durability — mirror generated media into our own storage (R2)

**Board:** SN81 · **Parked:** 2026-09-21 (owner decision) · **Priority when resumed:** medium-high before heavy paid usage.

### Problem
Generated media (Higgsfield images/videos) is **not stored on our infrastructure**.
We persist only the **Higgsfield-hosted URL** plus metadata in Postgres
(`assets.url`); the bytes live on Higgsfield's servers. Brand Studio outputs are
client-side (user's device) and are intentionally *not* our concern here.

So a customer-facing asset's longevity depends on Higgsfield keeping that URL
alive. Higgsfield's published policy (see below) governs *deletion*, not *CDN URL
permanence*, so a hotlinked URL can rotate/expire, and if the account lapses or a
generation is removed, our reference breaks.

### Higgsfield deletion rules (researched 2026-09-21, policy effective 2026-08-27)
- **Active account:** content is retained to operate the service; no published
  auto-expiry timer. Creators **own their outputs**; Higgsfield's license is
  narrow/temporary (run + maintain the service).
- **Delete a piece of content:** its storage license ends (routine backups +
  legally-required retention aside).
- **Delete the account:** inaccessible immediately, **restorable for 30 days**,
  then **permanently deleted**.
- **Model-training caveat:** content already used to train a model can't be
  removed from it; going forward, deleted content isn't used for training.
  Enterprise agreements are stricter (confidential, never used for training).
- Sources: higgsfield.ai/privacy-policy, higgsfield.ai/terms-of-use-agreement.

**Takeaway:** treat Higgsfield URLs as **ephemeral** for anything a paying
customer must keep long-term.

### The fix (phase-2)
Implement R2 mirroring — the code already stubs it:
- `src/lib/r2.ts` — `putObject()` currently throws `TODO(phase-2)`. Implement with
  `@aws-sdk/client-s3` pointed at the R2 endpoint
  (`https://<accountId>.r2.cloudflarestorage.com`). Env already named:
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
- On generation completion (runner / `src/lib/higgsfield.ts` — see the
  `extractMediaUrl` path, which notes "then use the R2 URL for durability"), fetch
  the Higgsfield URL, `putObject` into R2, and store the R2 URL + `storage_key` on
  the `assets` row (columns already exist: `assets.url`, `assets.storage_key`,
  `assets.file_size_bytes`).
- Serve customer-facing media from the R2 URL; keep the Higgsfield URL as a
  fallback/source-of-record.

### Definition of done
- New Higgsfield generations are copied to R2 on completion; `assets.storage_key`
  populated; customer-facing surfaces use the durable R2 URL.
- A backfill path for existing assets is optional/nice-to-have.
- Storage cost is now real (R2 is zero-egress, cheap) — factor into pricing.

### Why parked
No paid customers relying on long-term media yet; today's zero-storage design is a
cost saving. Revisit before onboarding paying users who need media to persist.
