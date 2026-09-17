-- 016_action_costs.sql — admin-editable per-action credit costs.
-- One shared media-credit wallet; each action type burns a configurable amount.
-- These set the pre-flight estimate and the per-generation budget charge.
-- Idempotent.
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS credit_cost_video integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS credit_cost_image integer NOT NULL DEFAULT 7;
