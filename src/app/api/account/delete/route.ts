import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";

/**
 * POST /api/account/delete — permanent. Requires the body { confirm: "DELETE" }.
 * Cancels billing now, soft-deletes the user's workspaces, anonymizes the user,
 * and deletes the Clerk login. Irreversible. The client redirects home after.
 */
export async function POST(request: Request) {
  const { user } = await getContext();
  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }
  try {
    await deleteAccount({ id: user.id, auth_id: user.auth_id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't delete the account." }, { status: 500 });
  }
}
