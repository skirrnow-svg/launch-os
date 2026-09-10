import { NextResponse } from "next/server";
import { getOrgId, requireUser } from "@/lib/auth";

/**
 * Admin integration settings API.
 *
 * GET   → returns the current keys MASKED (last 4 chars only), never in full.
 * PATCH → updates one or more integration keys for the caller's org.
 *
 * Keys are per-org and MUST be stored ENCRYPTED at rest (never plaintext, never
 * in a NEXT_PUBLIC_* var). TODO(phase-1): persist to the `integration_settings`
 * table (see db/schema.sql) via prisma, encrypting with a server-side key; and
 * gate to org admins only (Clerk role check) rather than any authed user.
 */

const MANAGED_KEYS = ["CLAUDE_API_KEY", "HIGGSFIELD_API_KEY"] as const;
type ManagedKey = (typeof MANAGED_KEYS)[number];

function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export async function GET() {
  await requireUser();
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "No active organization." }, { status: 400 });

  // TODO(phase-1): read row from integration_settings WHERE org_id = orgId.
  const stored: Partial<Record<ManagedKey, string>> = {};
  const masked = Object.fromEntries(
    MANAGED_KEYS.map((k) => [k, stored[k] ? mask(stored[k] as string) : null]),
  );
  return NextResponse.json({ settings: masked });
}

export async function PATCH(request: Request) {
  await requireUser();
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "No active organization." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Partial<Record<ManagedKey, string>> = {};
  for (const key of MANAGED_KEYS) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) updates[key] = v.trim();
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid keys to update." }, { status: 400 });
  }

  // TODO(phase-1): encrypt each value and upsert into integration_settings for orgId.
  return NextResponse.json({ updated: Object.keys(updates) });
}
