#!/usr/bin/env bash
#
# refresh-higgsfield-secret.sh
#
# Keeps the GitHub Actions generation runner authenticated to Higgsfield with
# NO manual secret-copying. Run on a schedule (Windows Task Scheduler, ~every
# 12h). It:
#   1. forces the Higgsfield CLI to refresh its access token from the
#      (longer-lived) refresh token,
#   2. verifies auth actually works,
#   3. pushes the refreshed credentials to the repo's GitHub secrets.
#
# The ONE thing it cannot do is the browser OAuth login: when Higgsfield's
# refresh token itself expires (~weekly, server-controlled), this script fails
# loudly and you must run `higgsfield auth login` once, after which it resumes.
#
# Safe to run often; it never prints secret values.
set -uo pipefail

export HOME="/c/Users/ADMIN"
HF="/c/Users/ADMIN/bin/higgsfield"
CRED="$HOME/.config/higgsfield/credentials.json"
CFG="$HOME/.config/higgsfield/config.json"
REPO="skirrnow-svg/launch-os"
LOG="$HOME/.config/higgsfield/secret-sync.log"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# 1) Refresh the access token (CLI refreshes from the stored refresh token when needed).
"$HF" auth token >/dev/null 2>&1 || true

# Best-effort Slack ping (webhook = first line of the repo's .env.local, if it's one).
notify() {
  local env_file="/c/Users/ADMIN/Documents/HarnessAgents/SkirrNow_LaunchOS/launch-os/.env.local"
  local hook
  hook="$(head -1 "$env_file" 2>/dev/null)"
  case "$hook" in
    https://hooks.slack.com/*)
      curl -fsS -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$1\"}" "$hook" >/dev/null 2>&1 || true ;;
  esac
}

# 2) Verify auth is live before touching the secrets.
if ! "$HF" account status >/dev/null 2>&1; then
  echo "$(ts) FAIL: Higgsfield auth is dead (refresh token likely expired). Run: higgsfield auth login" | tee -a "$LOG" >&2
  notify ":warning: *SkirrNow*: Higgsfield token expired — image/video generation is paused. Run \`higgsfield auth login\` on the host, then it auto-resumes within 12h (or run the sync task now)."
  exit 1
fi

# 3) Sync refreshed credentials to the GitHub secrets (values read from files, never echoed).
if gh secret set HIGGSFIELD_CREDENTIALS --repo "$REPO" < "$CRED" \
   && gh secret set HIGGSFIELD_CONFIG --repo "$REPO" < "$CFG"; then
  who="$("$HF" account status 2>/dev/null | head -1)"
  echo "$(ts) OK: secrets synced — $who" | tee -a "$LOG"
else
  echo "$(ts) FAIL: gh secret set failed (check gh auth status)" | tee -a "$LOG" >&2
  exit 2
fi
