-- Launch OS Database Schema
-- PostgreSQL (Neon) - Multi-tenant SaaS
-- Created for: https://github.com/launch-os/launch-os

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";  -- Case-insensitive text

-- ===== ORGANIZATIONS (TENANTS) =====

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  billing_address JSONB,
  max_projects INTEGER DEFAULT 10,
  max_contacts INTEGER DEFAULT 10000,
  max_api_calls_per_month INTEGER DEFAULT 100000,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);

-- ===== USERS =====

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email CITEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'clerk' CHECK (auth_provider IN ('clerk', 'auth0', 'google')),
  auth_id TEXT UNIQUE NOT NULL,
  auth_metadata JSONB,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- ===== ORGANIZATION MEMBERS (RBAC) =====

CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_accepted_at ON org_members(accepted_at) WHERE accepted_at IS NOT NULL;

-- ===== PROJECTS (LAUNCHES) =====

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  url TEXT,
  launch_date TIMESTAMP,
  template_type TEXT NOT NULL DEFAULT 'custom' CHECK (
    template_type IN ('ecommerce', 'saas', 'course', 'affiliate', 'custom')
  ),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'live', 'completed', 'archived')
  ),
  settings JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  UNIQUE(org_id, slug)
);

CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- ===== CONTACTS (AUDIENCE) =====

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company TEXT,
  tags TEXT[] DEFAULT '{}',
  properties JSONB DEFAULT '{}'::jsonb,
  segment_ids UUID[] DEFAULT '{}',
  email_bounced BOOLEAN DEFAULT false,
  email_unsubscribed BOOLEAN DEFAULT false,
  last_email_opened_at TIMESTAMP,
  last_email_clicked_at TIMESTAMP,
  last_website_visit_at TIMESTAMP,
  total_emails_opened INTEGER DEFAULT 0,
  total_emails_clicked INTEGER DEFAULT 0,
  estimated_deal_value NUMERIC(12, 2) DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, email)
);

CREATE INDEX idx_contacts_org_id ON contacts(org_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_email_bounced ON contacts(email_bounced) WHERE NOT email_bounced;

-- ===== ASSETS (IMAGES, VIDEOS, COPY) =====

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'copy', 'script')),
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT,  -- Original generation prompt for regeneration
  url TEXT,  -- R2 CDN URL
  storage_key TEXT UNIQUE,  -- R2 object key
  file_size_bytes INTEGER,
  duration_seconds INTEGER,  -- For videos
  dimensions JSONB,  -- { width, height } for images
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'failed')),
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assets_project_id ON assets(project_id);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_status ON assets(status);

-- ===== SEGMENTS (AUDIENCE TARGETING) =====

CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,  -- { AND: [ { field, operator, value } ] }
  contact_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_segments_project_id ON segments(project_id);

-- ===== EMAIL CAMPAIGNS =====

CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES segments(id),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  template_html TEXT NOT NULL,
  plain_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed')
  ),
  schedule_time TIMESTAMP,
  sent_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  resend_campaign_id TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_campaigns_project_id ON email_campaigns(project_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_schedule_time ON email_campaigns(schedule_time) WHERE status = 'scheduled';

-- ===== EMAIL CAMPAIGN RECIPIENTS =====

CREATE TABLE email_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_address CITEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'opened', 'clicked', 'bounced', 'complained', 'failed')
  ),
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced_at TIMESTAMP,
  resend_email_id TEXT,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_email_recipients_campaign_id ON email_recipients(campaign_id);
CREATE INDEX idx_email_recipients_contact_id ON email_recipients(contact_id);
CREATE INDEX idx_email_recipients_status ON email_recipients(status);

-- ===== EMAIL METRICS (WEBHOOK EVENTS) =====

CREATE TABLE email_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (
    event IN ('sent', 'opened', 'clicked', 'bounced', 'complained', 'failed')
  ),
  link_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_metrics_campaign_id ON email_metrics(campaign_id);
CREATE INDEX idx_email_metrics_contact_id ON email_metrics(contact_id);
CREATE INDEX idx_email_metrics_event ON email_metrics(event);
CREATE INDEX idx_email_metrics_timestamp ON email_metrics(timestamp DESC);

-- ===== EMAIL WORKFLOWS (BRANCHING LOGIC) =====

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'paused', 'archived')
  ),
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN ('manual', 'on_signup', 'on_purchase', 'abandoned_cart', 'date_based')
  ),
  trigger_config JSONB,
  steps JSONB NOT NULL,  -- [ { id, type, delay, template_id, condition, branches } ]
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_project_id ON workflows(project_id);
CREATE INDEX idx_workflows_status ON workflows(status);

-- ===== WORKFLOW INSTANCES =====

CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id TEXT NOT NULL,
  current_step_number INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'paused', 'failed')
  ),
  step_data JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_instances_workflow_id ON workflow_instances(workflow_id);
CREATE INDEX idx_workflow_instances_contact_id ON workflow_instances(contact_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);

-- ===== A/B TESTS =====

CREATE TABLE ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  variant_a_subject TEXT NOT NULL,
  variant_b_subject TEXT,
  variant_c_subject TEXT,
  variant_a_send_time TIMESTAMP,
  variant_b_send_time TIMESTAMP,
  variant_c_send_time TIMESTAMP,
  split_percent INTEGER NOT NULL DEFAULT 10 CHECK (split_percent > 0 AND split_percent < 100),
  test_duration_hours INTEGER NOT NULL DEFAULT 24,
  winner_metric TEXT NOT NULL CHECK (
    winner_metric IN ('open_rate', 'click_rate', 'conversion_rate')
  ),
  winner_variant TEXT,
  winner_probability NUMERIC(5, 2),  -- Confidence level
  test_started_at TIMESTAMP,
  test_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ab_tests_campaign_id ON ab_tests(campaign_id);
CREATE INDEX idx_ab_tests_test_completed_at ON ab_tests(test_completed_at) WHERE test_completed_at IS NOT NULL;

-- ===== SOCIAL POSTS =====

CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  platforms TEXT[] NOT NULL,  -- ['linkedin', 'instagram', 'twitter']
  schedule_time TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'posted', 'failed', 'archived')
  ),
  image_url TEXT,
  video_url TEXT,
  link_url TEXT,
  buffer_post_ids JSONB DEFAULT '{}'::jsonb,  -- { linkedin: "id", instagram: "id" }
  hashtags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_social_posts_project_id ON social_posts(project_id);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_schedule_time ON social_posts(schedule_time) WHERE status = 'scheduled';

-- ===== SOCIAL METRICS =====

CREATE TABLE social_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  event TEXT NOT NULL CHECK (
    event IN ('posted', 'impression', 'engagement', 'like', 'share', 'click', 'comment')
  ),
  count INTEGER DEFAULT 1,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_social_metrics_post_id ON social_metrics(post_id);
CREATE INDEX idx_social_metrics_platform ON social_metrics(platform);
CREATE INDEX idx_social_metrics_event ON social_metrics(event);

-- ===== API USAGE (BILLING) =====

CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_usage_org_id ON api_usage(org_id);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp DESC);

-- ===== WEBHOOK LOGS (DEBUGGING) =====

CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('resend', 'buffer', 'higgsfield', 'stripe')),
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed) WHERE NOT processed;
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- ===== INTEGRATION TOKENS =====

CREATE TABLE integration_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('resend', 'buffer', 'stripe')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, service)
);

CREATE INDEX idx_integration_tokens_org_id ON integration_tokens(org_id);

-- ===== PROJECT CURSORRULES (BRAND DESIGN RULES) =====

CREATE TABLE project_cursorrules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  cursorrules_text TEXT NOT NULL,
  brand_config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- colors, tone, product type
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_cursorrules_project_id ON project_cursorrules(project_id);

-- ===== AUDIT LOGS =====

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ===== VIEWS (HANDY QUERIES) =====

-- View: Campaign performance summary
CREATE VIEW campaign_performance AS
SELECT
  ec.id AS campaign_id,
  ec.name,
  ec.project_id,
  COUNT(DISTINCT er.contact_id) AS total_recipients,
  SUM(CASE WHEN er.status = 'sent' THEN 1 ELSE 0 END) AS emails_sent,
  SUM(CASE WHEN er.status IN ('opened', 'clicked') THEN 1 ELSE 0 END) AS emails_opened,
  ROUND(100.0 * SUM(CASE WHEN er.status IN ('opened', 'clicked') THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT er.contact_id), 0), 2) AS open_rate_pct,
  ec.created_at
FROM email_campaigns ec
LEFT JOIN email_recipients er ON ec.id = er.campaign_id
GROUP BY ec.id, ec.name, ec.project_id, ec.created_at;

-- View: Contact engagement summary
CREATE VIEW contact_engagement AS
SELECT
  c.id,
  c.email,
  c.total_emails_opened,
  c.total_emails_clicked,
  c.last_email_opened_at,
  c.last_email_clicked_at,
  CASE
    WHEN c.last_email_opened_at > NOW() - INTERVAL '7 days' THEN 'very_active'
    WHEN c.last_email_opened_at > NOW() - INTERVAL '30 days' THEN 'active'
    WHEN c.last_email_opened_at > NOW() - INTERVAL '90 days' THEN 'inactive'
    ELSE 'very_inactive'
  END AS engagement_level
FROM contacts c;

-- ===== FUNCTIONS =====

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Calculate segment contact count
CREATE OR REPLACE FUNCTION update_segment_contact_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE segments
  SET contact_count = (
    SELECT COUNT(*) FROM contacts
    WHERE org_id = (SELECT org_id FROM projects WHERE id = NEW.project_id)
    -- WHERE segment check would go here (simplified)
  )
  WHERE project_id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update segment count when contacts change
CREATE TRIGGER update_segment_count_on_contact_change AFTER INSERT OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_segment_contact_count();

-- ===== PERMISSIONS (for Vercel/Lambda) =====

-- Create a read-only user (for backups)
CREATE USER launch_os_readonly WITH PASSWORD 'CHANGE_ME';
GRANT CONNECT ON DATABASE launch_os TO launch_os_readonly;
GRANT USAGE ON SCHEMA public TO launch_os_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO launch_os_readonly;

-- Create an app user (for backend)
CREATE USER launch_os_app WITH PASSWORD 'CHANGE_ME';
GRANT CONNECT ON DATABASE launch_os TO launch_os_app;
GRANT USAGE ON SCHEMA public TO launch_os_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO launch_os_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO launch_os_app;

-- ===== FINAL CHECKS =====

-- Verify all tables created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
