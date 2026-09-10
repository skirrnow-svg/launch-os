# Launch OS

Multi-tenant SaaS for **AI-native launch orchestration** — teams generate
marketing assets (image / video / email / social) with AI, orchestrate
multi-channel campaigns, and track results in one dashboard.

> Full specs live in `../New Instructions/` (00-PROJECT-HANDOFF, 01-ARCHITECTURE,
> 02-DATABASE_SCHEMA.sql, 03-DEVELOPMENT_SETUP, 05-DEPLOYMENT_CLOUDFLARE,
> 08-LAUNCH_OS_BRAND_SYSTEM). This app is the Phase-0 scaffold of that plan.

## Stack (locked)

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Prisma → Neon
Postgres · Clerk auth · Resend (email) · Buffer (social) · Claude + Higgsfield
(AI assets) · Cloudflare R2 (storage) · Cloudflare Pages + GitHub Actions.

## Setup

```bash
npm install                      # installs deps; postinstall runs `prisma generate`
cp .env.example .env.local       # then fill in real secrets (never commit .env.local)
npm run dev                      # http://localhost:3000
```

### Database (Neon)

`db/schema.sql` is the source of truth (from 02-DATABASE_SCHEMA.sql). After
linking a Neon branch and applying it, generate Prisma models from the live DB:

```bash
npx prisma db pull               # populate prisma/schema.prisma from the DB
npx prisma generate
```

## Guardrails

Higgsfield generation is budget-capped — see
[`docs/HIGGSFIELD_GUARDRAILS.md`](docs/HIGGSFIELD_GUARDRAILS.md). Never commit
secrets; `.env*.local` is git-ignored.

## Scripts

`dev` · `build` · `start` · `lint` · `type-check` · `test` (vitest) ·
`db:migrate` · `db:studio`. See `package.json`.
