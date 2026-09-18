-- 018_landing_override.sql — make per-plan landing-page allowance admin-editable.
-- Adds a nullable override (null = use the code default for that tier). Idempotent.
ALTER TABLE pricing_overrides
  ADD COLUMN IF NOT EXISTS landing_pages integer;
