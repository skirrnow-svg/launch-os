-- SN25b: allow a subscription to be flagged for cancellation at period end.
-- When true, recurring billing is stopped at Razorpay but the plan's access
-- continues until the current period ends (the webhook then downgrades to free).
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
