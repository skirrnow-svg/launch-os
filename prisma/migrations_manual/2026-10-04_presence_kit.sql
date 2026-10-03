-- Module 1: AI Presence Kit — additive only (CREATE TABLE/INDEX IF NOT EXISTS).
-- Apply to Neon with: npx prisma db execute --file <this> --schema prisma/schema.prisma
-- Mirror the schema.prisma change to `main` as well.

CREATE TABLE IF NOT EXISTS presence_kits (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL,
  project_id        uuid NOT NULL,
  client_profile_id text,
  status            text NOT NULL DEFAULT 'queued',
  business_name     text NOT NULL,
  category          text,
  location          text,
  inputs            jsonb DEFAULT '{}',
  landing_page_id   uuid,
  asset_ids         uuid[] NOT NULL DEFAULT '{}',
  error             text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_presence_kits_org ON presence_kits(org_id);
CREATE INDEX IF NOT EXISTS idx_presence_kits_project ON presence_kits(project_id);
CREATE INDEX IF NOT EXISTS idx_presence_kits_status ON presence_kits(status);

CREATE TABLE IF NOT EXISTS review_requests (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL,
  project_id        uuid NOT NULL,
  client_profile_id text,
  contact_name      text,
  contact_email     citext NOT NULL,
  channel           text NOT NULL DEFAULT 'email',
  status            text NOT NULL DEFAULT 'queued',
  google_place_url  text,
  token             text NOT NULL,
  message           text,
  sent_at           timestamptz,
  clicked_at        timestamptz,
  reviewed_at       timestamptz,
  error             text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_requests_token ON review_requests(token);
CREATE INDEX IF NOT EXISTS idx_review_requests_org ON review_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_project ON review_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(status);
