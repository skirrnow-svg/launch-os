-- 008: pitch source + opt-in video for leads.
-- `source` distinguishes inbound leads from operator-initiated pitches.
-- `auto_video` lets the runner generate copy only (false) and leave the concept
-- video as an explicit, cost-previewed action (respects the shared credit pool).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'inbound';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS auto_video boolean NOT NULL DEFAULT true;
