-- 012_subscriptions.sql
-- Subscription layer: an org's active plan + billing anchor drives its
-- entitlements (Higgsfield credits + Claude tokens) and the reset cycle.
--
-- One row per org (unique). anchor_at is the billing-cycle anchor (the day the
-- monthly period turns over); the active period is computed from it in code, so
-- allowances reset each billing cycle with no cron. provider='manual' until
-- Razorpay (SN25) is wired, at which point webhooks upsert provider='razorpay'
-- with the real period + external_id. Additive + idempotent.
CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_slug   text NOT NULL,                       -- starter | growth | scale
  status      text NOT NULL DEFAULT 'active',      -- active | trialing | canceled
  provider    text NOT NULL DEFAULT 'manual',      -- manual | razorpay
  external_id text,
  anchor_at   timestamptz NOT NULL DEFAULT now(),  -- billing-cycle anchor day
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions (org_id);
