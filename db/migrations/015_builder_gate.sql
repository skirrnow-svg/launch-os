-- 015_builder_gate.sql — AI Video Prompt Builder access thresholds.
-- Idempotent. Gates are by the org plan's monthly credit allowance:
--   guided/basic path unlocks at >= builder_basic_min_credits,
--   Advanced controls unlock at >= builder_advanced_min_credits.
-- Admin-editable from the pricing console.
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS builder_basic_min_credits    integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS builder_advanced_min_credits integer NOT NULL DEFAULT 25;
