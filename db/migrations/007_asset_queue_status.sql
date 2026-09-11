-- Align assets.status with the values the queue pipeline actually writes.
-- The edge generate route sets 'queued'; the runner sets 'generating' →
-- 'ready', 'error' on failure, and 'budget-exceeded'/'draft' on cap. The
-- original CHECK only allowed draft/generating/ready/failed, so queue-mode
-- media (and the autonomous sample video) could never be enqueued.
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE assets ADD CONSTRAINT assets_status_check
  CHECK (status = ANY (ARRAY['draft','queued','generating','ready','error','failed','budget-exceeded']));
