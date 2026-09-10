import { prisma } from "./db";
import { encrypt, decrypt } from "./crypto";

/**
 * Per-org integration secrets, stored ENCRYPTED in `integration_tokens`.
 *
 * The admin UI writes managed API keys here (Claude, Higgsfield). AI helpers
 * (src/lib/claude.ts, higgsfield.ts) read them via getOrgKey() so each org can
 * bring its own key; a missing org key falls back to the process env.
 */

/** Managed key name (env-style) → integration_tokens.service value. */
export const MANAGED_KEYS = {
  CLAUDE_API_KEY: "claude",
  HIGGSFIELD_API_KEY: "higgsfield",
} as const;

export type ManagedKey = keyof typeof MANAGED_KEYS;
export const MANAGED_KEY_NAMES = Object.keys(MANAGED_KEYS) as ManagedKey[];

/** Env var each managed key falls back to when the org has no stored value. */
const ENV_FALLBACK: Record<ManagedKey, string> = {
  CLAUDE_API_KEY: "CLAUDE_API_KEY",
  HIGGSFIELD_API_KEY: "HIGGSFIELD_API_KEY",
};

/** Store (encrypt + upsert) one managed key for an org. */
export async function setOrgKey(
  orgId: string,
  key: ManagedKey,
  value: string,
): Promise<void> {
  const service = MANAGED_KEYS[key];
  const access_token = encrypt(value);
  await prisma.integration_tokens.upsert({
    where: { org_id_service: { org_id: orgId, service } },
    update: { access_token, updated_at: new Date() },
    create: { org_id: orgId, service, access_token },
  });
}

/** Raw decrypted value for an org, or the env fallback, or null. */
export async function getOrgKey(
  orgId: string,
  key: ManagedKey,
): Promise<string | null> {
  const row = await prisma.integration_tokens.findUnique({
    where: { org_id_service: { org_id: orgId, service: MANAGED_KEYS[key] } },
  });
  if (row?.access_token) {
    const val = decrypt(row.access_token);
    if (val) return val;
  }
  return process.env[ENV_FALLBACK[key]] ?? null;
}

/** Masked view of every managed key for an org (for the admin UI). */
export async function getMaskedSettings(
  orgId: string,
): Promise<Record<ManagedKey, { set: boolean; masked: string | null; source: "org" | "env" | null }>> {
  const rows = await prisma.integration_tokens.findMany({
    where: { org_id: orgId, service: { in: Object.values(MANAGED_KEYS) } },
  });
  const byService = new Map(rows.map((r) => [r.service, r.access_token]));

  const out = {} as Record<
    ManagedKey,
    { set: boolean; masked: string | null; source: "org" | "env" | null }
  >;
  for (const key of MANAGED_KEY_NAMES) {
    const stored = byService.get(MANAGED_KEYS[key]);
    const orgVal = stored ? decrypt(stored) : null;
    if (orgVal) {
      out[key] = { set: true, masked: mask(orgVal), source: "org" };
    } else if (process.env[ENV_FALLBACK[key]]) {
      out[key] = { set: true, masked: mask(process.env[ENV_FALLBACK[key]]!), source: "env" };
    } else {
      out[key] = { set: false, masked: null, source: null };
    }
  }
  return out;
}

function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
