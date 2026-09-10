import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import {
  MANAGED_KEY_NAMES,
  getMaskedSettings,
  setOrgKey,
  type ManagedKey,
} from "@/lib/settings";

/**
 * Admin integration settings API.
 *
 * GET   → managed keys MASKED (last 4 chars only), with whether each is set and
 *         its source (this org's stored value, or the process env fallback).
 * PATCH → encrypts and upserts one or more keys into integration_tokens for the
 *         caller's org.
 *
 * Values are encrypted at rest (AES-256-GCM, see src/lib/crypto.ts) and never
 * returned in full. TODO(phase-1+): gate to org admins via org_members role.
 */

export async function GET() {
  const { org } = await getContext();
  const settings = await getMaskedSettings(org.id);
  return NextResponse.json({ org: org.name, settings });
}

export async function PATCH(request: Request) {
  const { org } = await getContext();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const updates: ManagedKey[] = [];
  for (const key of MANAGED_KEY_NAMES) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) {
      await setOrgKey(org.id, key, v.trim());
      updates.push(key);
    }
  }
  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid keys to update." }, { status: 400 });
  }
  return NextResponse.json({ org: org.name, updated: updates });
}
