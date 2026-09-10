import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";

/**
 * Admin integration settings API.
 *
 * GET   → returns the managed keys MASKED (last 4 chars only), never in full.
 * PATCH → updates one or more integration keys for the caller's org.
 *
 * Keys are per-org and MUST be stored ENCRYPTED at rest. TODO(phase-1): persist
 * to the `integration_tokens` table (see prisma schema) encrypted with a
 * server-side key, and gate to org admins only (role check) rather than any
 * authenticated user.
 */

const MANAGED_KEYS = ["CLAUDE_API_KEY", "HIGGSFIELD_API_KEY"] as const;
type ManagedKey = (typeof MANAGED_KEYS)[number];

function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export async function GET() {
  const { org } = await getContext();
  // TODO(phase-1): read stored values from integration_tokens WHERE org_id = org.id.
  const stored: Partial<Record<ManagedKey, string>> = {};
  const masked = Object.fromEntries(
    MANAGED_KEYS.map((k) => [k, stored[k] ? mask(stored[k] as string) : null]),
  );
  return NextResponse.json({ org: org.name, settings: masked });
}

export async function PATCH(request: Request) {
  const { org } = await getContext();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Partial<Record<ManagedKey, string>> = {};
  for (const key of MANAGED_KEYS) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) updates[key] = v.trim();
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid keys to update." }, { status: 400 });
  }
  // TODO(phase-1): encrypt each value and upsert into integration_tokens for org.id.
  return NextResponse.json({ org: org.name, updated: Object.keys(updates) });
}
