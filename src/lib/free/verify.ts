import crypto from "node:crypto";

/**
 * Stateless email-verification codes for the free Product-to-Ad generator.
 *
 * We email the visitor a 6-digit code and hand the browser an opaque signed
 * token (expiry + HMAC) — never the code. On verify we recompute the HMAC over
 * the email + the code the user typed + the expiry, so nothing needs to be
 * stored server-side. Signed with SETTINGS_ENCRYPTION_KEY (same secret the app
 * already uses), so tokens can't be forged.
 *
 * NOTE: this proves the visitor controls the email. Phone/SMS OTP (the stronger
 * bot gate) is deferred until an SMS provider is chosen — see docs/VISION.md.
 */
const TTL_MS = 10 * 60 * 1000; // codes valid for 10 minutes

function secret(): string {
  return (
    process.env.SETTINGS_ENCRYPTION_KEY?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    "skirrnow-free-generator-dev-secret"
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

const norm = (email: string) => email.trim().toLowerCase();

export function issueCode(email: string): { code: string; token: string; exp: number } {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const exp = Date.now() + TTL_MS;
  const token = `${exp}.${sign(`${norm(email)}|${code}|${exp}`)}`;
  return { code, token, exp };
}

export function verifyCode(email: string, code: string, token: string): boolean {
  const [expStr, sig] = String(token || "").split(".");
  const exp = Number(expStr);
  if (!exp || Number.isNaN(exp) || Date.now() > exp) return false;
  if (!sig) return false;
  const expected = sign(`${norm(email)}|${String(code || "").trim()}|${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
