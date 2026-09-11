# Generation runner

The web app (Cloudflare Pages) can't run the `higgsfield` / `claude` CLIs, so
generation is fulfilled here: a GitHub Actions workflow
(`.github/workflows/generate.yml`) runs `process-jobs.mjs` on a Linux VM.

**Flow:** Pages marks a row `queued` and fires a `repository_dispatch` →
this workflow wakes, claims queued rows atomically, runs the CLI, writes the
result back and sets `status = ready`. A `*/10` cron is the safety net.

## Required GitHub Actions secrets

Set under **repo → Settings → Secrets and variables → Actions**:

| Secret | How to get it |
|--------|---------------|
| `DATABASE_URL` | The Neon pooled connection string (same as `.env.local`). |
| `HIGGSFIELD_CREDENTIALS` | Contents of `~/.config/higgsfield/credentials.json` after `higgsfield auth login`. |
| `HIGGSFIELD_CONFIG` | Contents of `~/.config/higgsfield/config.json` (selected workspace). |
| `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token` — for the planned copy runner. |

## To wake the runner from the web app (queue mode)

Set on the Pages project:

- `GENERATION_MODE=queue`
- `GITHUB_DISPATCH_REPO=skirrnow-svg/launch-os`
- `GITHUB_DISPATCH_TOKEN=<fine-grained PAT: Contents + Actions write>`

## Scope

Currently processes **media assets** (image/video) via Higgsfield. Copy
(email/social via `claude -p`) is a planned addition — it needs a brief field
to enqueue against. Media results store the Higgsfield URL; mirroring to
Cloudflare R2 is a follow-up.
