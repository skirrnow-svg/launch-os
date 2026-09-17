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
ALERT_FLAG="$HOME/.config/higgsfield/.auth-alerted"
# Email settings (git-ignored, outside the repo): NOTIFY_SMTP_USER, NOTIFY_SMTP_PASS
# (a Gmail App Password), NOTIFY_TO (comma/semicolon-separated recipients).
NOTIFY_ENV="$HOME/.config/higgsfield/notify.env"
[ -f "$NOTIFY_ENV" ] && . "$NOTIFY_ENV"
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

# Email alert to all recipients. Subject is date-prefixed so an old alert is
# obvious at a glance. No-op unless notify.env supplies SMTP creds.
email_alert() {
  [ -n "${NOTIFY_SMTP_USER:-}" ] && [ -n "${NOTIFY_SMTP_PASS:-}" ] && [ -n "${NOTIFY_TO:-}" ] || return 0
  local subject list rcpt_args rcpts_hdr body tmp rc
  subject="$(date +%F) - MOST Important - SkirrNow HiggsField needs Auth"
  list="${NOTIFY_TO//;/ }"; list="${list//,/ }"
  rcpt_args=""; for r in $list; do rcpt_args="$rcpt_args --mail-rcpt $r"; done
  rcpts_hdr="$(echo $list | sed 's/ /, /g')"
  body="The SkirrNow generation runner cannot authenticate to Higgsfield.
Image / video / landing-page media generation is PAUSED until you re-authenticate.

ACTION REQUIRED (about 30 seconds), on the SkirrNow host machine:
  1. Run:  higgsfield auth login
  2. Sign in in the browser that opens.

That is all. The runner re-syncs automatically within 12 hours, or run the
Windows task 'SkirrNow-HiggsfieldSecretSync' to apply immediately.

Detected at: $(ts)
-- SkirrNow Ops (automated)"
  tmp="$(mktemp)"
  {
    printf 'From: SkirrNow Alerts <%s>\r\n' "$NOTIFY_SMTP_USER"
    printf 'To: %s\r\n' "$rcpts_hdr"
    printf 'Subject: %s\r\n' "$subject"
    printf 'Content-Type: text/plain; charset=UTF-8\r\n\r\n'
    printf '%s\r\n' "$body"
  } > "$tmp"
  curl -fsS --ssl-reqd "smtp://smtp.gmail.com:587" \
    --mail-from "$NOTIFY_SMTP_USER" $rcpt_args \
    --user "$NOTIFY_SMTP_USER:$NOTIFY_SMTP_PASS" \
    --upload-file "$tmp" >/dev/null 2>&1
  rc=$?; rm -f "$tmp"; return $rc
}

# Email at most once per outage / per 24h (Slack still fires every run).
should_email() {
  [ -f "$ALERT_FLAG" ] || return 0
  local age; age=$(( $(date +%s) - $(stat -c %Y "$ALERT_FLAG" 2>/dev/null || echo 0) ))
  [ "$age" -ge 86400 ]
}

# 2) Verify auth is live before touching the secrets.
if ! "$HF" account status >/dev/null 2>&1; then
  echo "$(ts) FAIL: Higgsfield auth is dead (refresh token likely expired). Run: higgsfield auth login" | tee -a "$LOG" >&2
  notify ":warning: *SkirrNow*: Higgsfield token expired — image/video generation is paused. Run \`higgsfield auth login\` on the host, then it auto-resumes within 12h (or run the sync task now)."
  if should_email; then
    if email_alert; then echo "$(ts) email alert sent to $NOTIFY_TO" | tee -a "$LOG"; touch "$ALERT_FLAG";
    else echo "$(ts) email alert FAILED (check notify.env / Gmail App Password)" | tee -a "$LOG" >&2; fi
  fi
  exit 1
fi

# 3) Sync refreshed credentials to the GitHub secrets (values read from files, never echoed).
if gh secret set HIGGSFIELD_CREDENTIALS --repo "$REPO" < "$CRED" \
   && gh secret set HIGGSFIELD_CONFIG --repo "$REPO" < "$CFG"; then
  who="$("$HF" account status 2>/dev/null | head -1)"
  rm -f "$ALERT_FLAG"  # auth healthy again → re-arm alerts for the next outage
  echo "$(ts) OK: secrets synced — $who" | tee -a "$LOG"
else
  echo "$(ts) FAIL: gh secret set failed (check gh auth status)" | tee -a "$LOG" >&2
  exit 2
fi
