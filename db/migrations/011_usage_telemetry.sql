-- 011_usage_telemetry.sql
-- Two-axis usage telemetry + audit trail.
--   * Higgsfield credits  → media (image/video/website). Existing counter:
--     organizations.credits_used / credit_cap.
--   * Claude tokens       → copy/audit/briefs. NEW counter:
--     organizations.claude_tokens_used / claude_token_cap. Metered separately
--     from Higgsfield credits and included (generously) in every plan.
-- usage_events is the itemized ledger (one row per generation), and audit_logs
-- (already in the schema, previously unused) now records admin config changes.
-- All additive + idempotent.

-- Per-org Claude-token budget, parallel to credits. NULL cap = no limit.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS claude_tokens_used bigint NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS claude_token_cap  bigint;

-- Itemized usage ledger. provider: 'higgsfield' | 'claude'. credits are
-- Higgsfield credits (0 for Claude); tokens are Claude tokens (0 for Higgsfield,
-- currently an estimate = chars/4). ref_* points at the produced artifact.
CREATE TABLE IF NOT EXISTS usage_events (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  provider   text NOT NULL,
  kind       text NOT NULL,
  model      text,
  credits    numeric NOT NULL DEFAULT 0,
  tokens     bigint  NOT NULL DEFAULT 0,
  estimated  boolean NOT NULL DEFAULT false,
  status     text NOT NULL DEFAULT 'ok',
  ref_type   text,
  ref_id     text,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_created ON usage_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_provider    ON usage_events (provider);
CREATE INDEX IF NOT EXISTS idx_usage_events_created     ON usage_events (created_at DESC);
