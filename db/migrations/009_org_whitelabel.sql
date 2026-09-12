-- 009_org_whitelabel.sql
-- White-label + account-type support on organizations.
--   account_type: 'solo' | 'sme' | 'agency' (agency = white-label).
--   brand_name / brand_color: agency branding (logo_url already exists).
-- Additive + idempotent; safe to re-run.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'solo';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_color text;
