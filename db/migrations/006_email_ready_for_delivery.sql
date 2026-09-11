-- Allow the HITL "1-Click Approve & Deliver" terminal status on campaigns.
ALTER TABLE email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_status_check;
ALTER TABLE email_campaigns ADD CONSTRAINT email_campaigns_status_check
  CHECK (status = ANY (ARRAY['draft','scheduled','sending','sent','paused','failed','queued','generating','ready_for_delivery']));
