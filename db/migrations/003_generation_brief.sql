-- 003_generation_brief: store the AI brief so copy jobs can be queued + fulfilled by the runner.
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS generation_brief TEXT;
ALTER TABLE social_posts    ADD COLUMN IF NOT EXISTS generation_brief TEXT;
