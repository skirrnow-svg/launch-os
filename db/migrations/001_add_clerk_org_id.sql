-- 001_add_clerk_org_id
-- Map Clerk Organizations to DB organizations. Additive + idempotent.
-- Applied to Neon via `prisma db execute`; models refreshed with `prisma db pull`.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_org_id TEXT UNIQUE;
