-- Allow the async copy pipeline's transient statuses on the copy tables.
-- The web tier enqueues with status='queued'; the GitHub Actions runner sets
-- 'generating' while it calls `claude -p`, then 'draft' with the result.
-- The original CHECK constraints omitted these, so enqueue/generation failed.
ALTER TABLE email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_status_check;
ALTER TABLE email_campaigns ADD CONSTRAINT email_campaigns_status_check
  CHECK (status = ANY (ARRAY['draft','scheduled','sending','sent','paused','failed','queued','generating']));

ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status = ANY (ARRAY['draft','scheduled','posted','failed','archived','queued','generating']));
