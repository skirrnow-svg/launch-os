import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "edge";

/**
 * Current organization API.
 * GET   → the active org (id, name, slug).
 * PATCH → rename the active org (used by the onboarding wizard). Only the name
 *         is editable; the slug/clerk mapping are immutable identity.
 */

export async function GET() {
  const { org } = await getContext();
  return NextResponse.json({ org: { id: org.id, name: org.name, slug: org.slug } });
}

export async function PATCH(request: Request) {
  const { org } = await getContext();
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "A workspace name is required." }, { status: 400 });
  }
  const updated = await prisma.organizations.update({
    where: { id: org.id },
    data: { name: name.slice(0, 120) },
  });
  return NextResponse.json({ org: { id: updated.id, name: updated.name, slug: updated.slug } });
}
