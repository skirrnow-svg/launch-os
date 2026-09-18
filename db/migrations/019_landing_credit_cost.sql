-- 019_landing_credit_cost.sql — Option B (hybrid) landing-page pricing.
-- Each plan includes a free landing-page quota; EXTRA pages beyond it cost this
-- many credits. 0 = no overage (the included quota stays a hard cap). Idempotent.
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS credit_cost_landing integer NOT NULL DEFAULT 3;
