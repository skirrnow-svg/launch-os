-- 010_pricing_offers_coupons.sql
-- Base-provider (platform admin) controls: editable base pricing, a signup
-- offer, and discount coupons. All additive + idempotent. The hardcoded
-- BILLING_TIERS catalog (src/lib/billing/plans.ts) stays the DEFAULTS; a row in
-- pricing_overrides layers on top per tier slug. platform_settings is a single
-- 'singleton' row holding the signup-offer config.

-- Per-tier price / credit overrides (NULL column = fall back to the code default).
CREATE TABLE IF NOT EXISTS pricing_overrides (
  slug              text PRIMARY KEY,
  price_inr         integer,
  credits_per_month integer,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Platform-wide signup offer (one row).
CREATE TABLE IF NOT EXISTS platform_settings (
  id                     text PRIMARY KEY DEFAULT 'singleton',
  welcome_credits        integer NOT NULL DEFAULT 0,
  intro_discount_percent integer NOT NULL DEFAULT 0,
  offer_active           boolean NOT NULL DEFAULT false,
  offer_label            text,
  updated_at             timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- Discount coupons. kind: 'percent' (value = 0-100) or 'flat' (value = whole INR
-- off). applies_to: 'all' or a comma-separated list of tier slugs. Redemption
-- counting + payment capture are wired later with the Razorpay gate (SN25); this
-- table stores + validates coupons only.
CREATE TABLE IF NOT EXISTS coupons (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code            text NOT NULL UNIQUE,
  kind            text NOT NULL DEFAULT 'percent',
  value           integer NOT NULL DEFAULT 0,
  applies_to      text NOT NULL DEFAULT 'all',
  max_redemptions integer,
  redeemed_count  integer NOT NULL DEFAULT 0,
  expires_at      timestamptz,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
