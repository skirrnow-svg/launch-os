-- 017_video_base_cost.sql — reframe video credit cost as a BASE (minimum).
-- A video's real cost is a range (short 480p ~6 credits; longer / higher-res
-- more), so we show "from ~N credits". Lower the default to the true base and
-- reset the singleton only if it still holds the old conservative default (30),
-- so an admin's own edit is never clobbered. Idempotent.
ALTER TABLE platform_settings ALTER COLUMN credit_cost_video SET DEFAULT 6;
UPDATE platform_settings SET credit_cost_video = 6
  WHERE id = 'singleton' AND credit_cost_video = 30;
