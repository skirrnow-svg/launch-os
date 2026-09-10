import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

/**
 * Symmetric encryption for secrets at rest (integration API keys).
 *
 * AES-256-GCM. The 32-byte key comes from SETTINGS_ENCRYPTION_KEY when set
 * (hex or base64 of 32 bytes); otherwise it is derived from CLERK_SECRET_KEY
 * via scrypt so dev works without an extra env. Ciphertext is serialized as
 * `v1:<iv>:<authTag>:<ciphertext>` (each part base64), so the format is
 * self-describing and rotatable.
 *
 * NOTE: deriving from CLERK_SECRET_KEY means rotating that key makes existing
 * stored ciphertext undecryptable — set a dedicated SETTINGS_ENCRYPTION_KEY in
 * production. A decrypt() failure is treated as "no value" by callers.
 */

const VERSION = "v1";

function resolveKey(): Buffer {
  const explicit = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (explicit) {
    // Accept hex (64 chars) or base64; must decode to exactly 32 bytes.
    const asHex =
      /^[0-9a-f]{64}$/i.test(explicit) ? Buffer.from(explicit, "hex") : null;
    const buf = asHex ?? Buffer.from(explicit, "base64");
    if (buf.length === 32) return buf;
    // Fall through to scrypt-stretch whatever was provided.
    return scryptSync(explicit, "launch-os:settings", 32);
  }
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "No encryption key: set SETTINGS_ENCRYPTION_KEY (or CLERK_SECRET_KEY).",
    );
  }
  return scryptSync(secret, "launch-os:settings", 32);
}

export function encrypt(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

/** Returns the plaintext, or null if the payload is malformed/undecryptable. */
export function decrypt(payload: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) return null;
    const key = resolveKey();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
