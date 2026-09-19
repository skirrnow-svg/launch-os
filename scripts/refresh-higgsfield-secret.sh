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
# Alert email flows through Resend (transactional API) — the app's own email
# transport, already domain-verified. The API key is read from the app's
# .env.local (source of truth); recipients + optional From come from notify.env:
#   NOTIFY_TO   = comma/semicolon-separated recipients (required to send)
#   NOTIFY_FROM = optional override (default: a verified skirrnow.com sender)
NOTIFY_ENV="$HOME/.config/higgsfield/notify.env"
[ -f "$NOTIFY_ENV" ] && . "$NOTIFY_ENV"
RESEND_API_KEY="$(grep -m1 '^RESEND_API_KEY=' "$PROJECT/.env.local" 2>/dev/null | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//')"
RESEND_FROM="${NOTIFY_FROM:-SkirrNow Alerts <skirrnow.agent@skirrnow.com>}"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Email all recipients that one or more providers need re-auth. $1 = which,
# e.g. "Higgsfield", "Claude", or "Higgsfield and Claude".
email_alert() {
  [ -n "${RESEND_API_KEY:-}" ] && [ -n "${NOTIFY_TO:-}" ] || {
    echo "$(ts) WARN: alert skipped — RESEND_API_KEY or NOTIFY_TO not set" | tee -a "$LOG" >&2
    return 0
  }
  RESEND_API_KEY="$RESEND_API_KEY" RESEND_FROM="$RESEND_FROM" NOTIFY_TO="$NOTIFY_TO" \
  ALERT_WHICH="$1" ALERT_TS="$(ts)" node -e '
    const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM;
    const to = process.env.NOTIFY_TO.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    const which = process.env.ALERT_WHICH, when = process.env.ALERT_TS;
    const action = /Higgsfield/.test(which) ? "higgsfield auth login"
      : /Claude/.test(which) ? "claude setup-token"
      : "re-authenticate the affected provider";
    const subject = new Date().toISOString().slice(0, 10) + " - MOST Important - SkirrNow needs Auth: " + which;
    const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.55">
      <h2 style="margin:0 0 8px">SkirrNow — ${which} authentication is down</h2>
      <p>The generation runner cannot authenticate to <b>${which}</b>. Affected generation is <b>paused</b> — queued jobs are <b>held, not lost</b>.</p>
      <p style="margin:14px 0 4px"><b>Action required</b> on the SkirrNow host machine:</p>
      <pre style="background:#f1f5f9;padding:10px 12px;border-radius:8px;margin:0 0 10px;font-size:13px">${action}</pre>
      <p style="color:#64748b">Only the provider named above needs attention. Once done, the runner re-syncs automatically within 12h.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:14px">Detected ${when} · SkirrNow Ops (automated, via Resend)</p>
    </div>`;
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    }).then(async (r) => {
      if (!r.ok) { console.error("resend " + r.status + " " + (await r.text()).slice(0, 200)); process.exit(1); }
      process.exit(0);
    }).catch((e) => { console.error(String(e)); process.exit(1); });
  '
  return $?
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
