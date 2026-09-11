-- 002_org_credit_budget: per-org generation credit budget (multi-tenant fix #1).
-- credit_cap NULL = unlimited (single-owner default); a number caps that org.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credit_cap INTEGER;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credits_used NUMERIC NOT NULL DEFAULT 0;
