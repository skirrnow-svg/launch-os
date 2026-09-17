#!/usr/bin/env bash
#
# refresh-higgsfield-secret.sh  —  SkirrNow auth watchdog (run every ~12h)
#
# 1. Refreshes the Higgsfield CLI token and pushes it to the GitHub secrets so
#    the generation runner stays authenticated (no manual copying).
# 2. Checks BOTH providers' auth health — Higgsfield directly, Claude via the
#    status the runner writes to platform_settings — and, if either is down,
#    emails all owner addresses ONE "MOST Important … needs Auth" alert
#    (date-prefixed subject; de-duped to once per 24h).
#
# What still needs a human: the browser re-auth itself.
#   Higgsfield (~weekly):  higgsfield auth login
#   Claude    (~yearly):   claude setup-token   (then update the secret)
#
# Never prints secret values.
set -uo pipefail

export HOME="/c/Users/ADMIN"
HF="/c/Users/ADMIN/bin/higgsfield"
PROJECT="/c/Users/ADMIN/Documents/HarnessAgents/SkirrNow_LaunchOS/launch-os"
CRED="$HOME/.config/higgsfield/credentials.json"
CFG="$HOME/.config/higgsfield/config.json"
REPO="skirrnow-svg/launch-os"
LOG="$HOME/.config/higgsfield/secret-sync.log"
ALERT_FLAG="$HOME/.config/higgsfield/.auth-alerted"
# Email settings (git-ignored): NOTIFY_SMTP_USER, NOTIFY_SMTP_PASS (Gmail App
# Password), NOTIFY_TO (comma/semicolon-separated recipients).
NOTIFY_ENV="$HOME/.config/higgsfield/notify.env"
[ -f "$NOTIFY_ENV" ] && . "$NOTIFY_ENV"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Email all recipients that one or more providers need re-auth. $1 = which,
# e.g. "Higgsfield", "Claude", or "Higgsfield and Claude".
email_alert() {
  [ -n "${NOTIFY_SMTP_USER:-}" ] && [ -n "${NOTIFY_SMTP_PASS:-}" ] && [ -n "${NOTIFY_TO:-}" ] || return 0
  local which="$1" subject list rcpt_args rcpts_hdr body tmp rc
  subject="$(date +%F) - MOST Important - SkirrNow needs Auth: ${which}"
  list="${NOTIFY_TO//;/ }"; list="${list//,/ }"
  rcpt_args=""; for r in $list; do rcpt_args="$rcpt_args --mail-rcpt $r"; done
  rcpts_hdr="$(echo $list | sed 's/ /, /g')"
  body="SkirrNow's generation runner can't authenticate to: ${which}.
Affected generation is PAUSED until you re-authenticate (jobs are held, not lost).

ACTION REQUIRED (on the SkirrNow host machine):
  - Higgsfield:  run  higgsfield auth login   (browser sign-in; ~weekly)
  - Claude:      run  claude setup-token      (browser; ~yearly) then tell your operator to update the secret

Only the provider(s) named in the subject need attention. Higgsfield re-syncs
automatically within 12h once you log in.

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

# Email at most once per outage / per 24h.
should_email() {
  [ -f "$ALERT_FLAG" ] || return 0
  local age; age=$(( $(date +%s) - $(stat -c %Y "$ALERT_FLAG" 2>/dev/null || echo 0) ))
  [ "$age" -ge 86400 ]
}

# ---- Higgsfield: refresh token, verify, sync secrets ------------------------
"$HF" auth token >/dev/null 2>&1 || true
HF_OK=1
if "$HF" account status >/dev/null 2>&1; then
  if gh secret set HIGGSFIELD_CREDENTIALS --repo "$REPO" < "$CRED" \
     && gh secret set HIGGSFIELD_CONFIG --repo "$REPO" < "$CFG"; then
    echo "$(ts) OK: Higgsfield secrets synced — $("$HF" account status 2>/dev/null | head -1)" | tee -a "$LOG"
  else
    echo "$(ts) WARN: gh secret set failed (check gh auth status)" | tee -a "$LOG" >&2
  fi
else
  HF_OK=0
  echo "$(ts) FAIL: Higgsfield auth is dead — run: higgsfield auth login" | tee -a "$LOG" >&2
fi

# ---- Claude: read the runner's last-reported status from the DB ------------
CLAUDE_DOWN=0
DBSTATUS="$( cd "$PROJECT" 2>/dev/null && export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//')" && node scripts/auth-watch.cjs 2>/dev/null )"
case "$DBSTATUS" in
  *CLAUDE=down*) CLAUDE_DOWN=1 ;;
esac

# ---- Unified alert ---------------------------------------------------------
DOWN=""
[ "$HF_OK" -eq 0 ] && DOWN="Higgsfield"
[ "$CLAUDE_DOWN" -eq 1 ] && DOWN="${DOWN:+$DOWN and }Claude"

if [ -n "$DOWN" ]; then
  if should_email; then
    if email_alert "$DOWN"; then echo "$(ts) email alert sent ($DOWN) to $NOTIFY_TO" | tee -a "$LOG"; touch "$ALERT_FLAG";
    else echo "$(ts) email alert FAILED (check notify.env / Gmail App Password)" | tee -a "$LOG" >&2; fi
  fi
  exit 1
else
  rm -f "$ALERT_FLAG"  # all providers healthy → re-arm alerts for the next outage
  exit 0
fi
