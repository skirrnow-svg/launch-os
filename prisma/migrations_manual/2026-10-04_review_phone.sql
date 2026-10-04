-- SN84: add contact_phone to review_requests for the WhatsApp channel.
-- Additive, idempotent. Apply with:
--   export $(grep '^DATABASE_URL' .env.local) && \
--   npx prisma db execute --file prisma/migrations_manual/2026-10-04_review_phone.sql --schema prisma/schema.prisma
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS contact_phone text;
