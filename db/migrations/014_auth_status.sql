-- Auth health flags for the generation runner, written each run and read by the
-- local secret-sync task to send the unified "needs auth" alert email.
-- Idempotent.
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS claude_auth_ok boolean;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS higgsfield_auth_ok boolean;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS auth_checked_at timestamptz;
