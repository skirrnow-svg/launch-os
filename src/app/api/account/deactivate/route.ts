import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { deactivateAccount } from "@/lib/account";

/**
 * POST /api/account/deactivate — reversible. Cancels recurring billing at cycle
 * end and marks the account inactive; data is kept. The client signs the user
 * out afterwards; signing back in reactivates the account.
 */
export async function POST() {
  const { user } = await getContext();
  try {
    await deactivateAccount(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't deactivate." }, { status: 500 });
  }
}
