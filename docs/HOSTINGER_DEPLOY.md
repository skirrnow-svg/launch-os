# Deploying Launch OS to Hostinger (Node.js)

This app is a Next.js 14.2.15 App Router application configured with
`output: "standalone"` and every route on the **Node.js runtime** (no edge
runtime), so it runs as a normal Node server on Hostinger's Node.js hosting.

> Companion step-by-step (phased, with hPanel screenshots-order):
> https://claude.ai/code/artifact/90ac1e5d-9982-4f27-9f47-861f361e5db3
> The domain is the **last** step — everything below works on Hostinger's
> temporary `*.hostingersite.com` URL first.

---

## Recommended path — Git import (auto-deploy on push)

Hostinger's **Website → Add web app → Node.js → Deploy Your Web App** screen
offers "Import your Git repository". This is the recommended path.

1. **Connect with GitHub** (the repo `skirrnow-svg/launch-os` is private, so the
   public-URL field will not work — OAuth is required). Authorize Hostinger for
   the `skirrnow-svg` account and select the **`launch-os`** repository.
2. **Branch:** `hostinger-deploy` (this branch carries the standalone + Node
   runtime changes). `main` remains the Cloudflare/edge target.
3. **Build settings:**
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output: Next.js standalone (`.next/standalone`)
   - Start command: `node .next/standalone/server.js`
   - Node version: **20** (18 also works)
4. **Environment variables:** add every value from `.env.example` (see the
   required block). Secrets live here, never in the repo.
5. **Deploy.** Hostinger clones, installs, builds, and starts the app, then
   auto-redeploys on every push to the selected branch.

### Standalone static assets
Next.js `standalone` output copies `server.js` and the minimal `node_modules`,
but **not** `.next/static` or `public`. If Hostinger's Next.js detection does
not copy them automatically, ensure the deploy includes:

```
.next/standalone/          # server.js + runtime deps  (run from here)
.next/static/    -> copied alongside as .next/standalone/.next/static
public/          -> copied alongside as .next/standalone/public
```

The provided start command assumes standard Next.js standalone layout; if static
assets 404, copy those two folders into the standalone dir as shown.

---

## Alternative — upload a prebuilt bundle
If you prefer not to connect GitHub, build locally and upload:

```bash
npm ci
npm run build
# upload .next/standalone (with .next/static and public copied in) + package.json
# start: node server.js   (from the standalone root)
```

---

## Environment variables (required)
See `.env.example` for the full annotated list. The minimum to boot:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres (pooled connection string) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk auth |
| `NEXT_PUBLIC_APP_URL` | Temporary Hostinger URL for now; the real domain at go-live |
| `SETTINGS_ENCRYPTION_KEY` | 32-byte hex; decrypts org integration tokens |
| `GITHUB_DISPATCH_REPO` / `GITHUB_DISPATCH_TOKEN` | Wakes the generation runner |
| `DEFAULT_LEAD_ORG_ID` | Org the public lead form writes to |
| `R2_*` | Cloudflare R2 for generated media |

No `CLAUDE_API_KEY` / `HIGGSFIELD_API_KEY` is needed — generation runs on the
GitHub Actions runner via the Claude Code and Higgsfield **subscription CLIs**.

---

## Auth (Clerk) allowlist
Clerk ties sign-in to approved origins. Before testing login, the Hostinger
preview URL (and later the real domain) must be added to Clerk's allowed
origins. This is a dashboard edit, no code change.

---

## Domain & HTTPS (last step)
1. Test everything on the temporary URL first.
2. Point the domain at the Hostinger app (assign in hPanel, or A record / NS).
3. Issue the free Let's Encrypt SSL in hPanel.
4. Change `NEXT_PUBLIC_APP_URL` to the real domain, add it to Clerk, restart.

---

## What is NOT part of this host
The generation runner (copy via `claude -p`, media via `higgsfield`) runs on
**GitHub Actions**, independent of where the web app is hosted. Moving the web
app to Hostinger does not touch the runner, the R2 bucket, or the hard
200-credit/month Higgsfield guardrail.
