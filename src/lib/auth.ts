import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Auth helpers (Clerk).
 * Thin wrappers so route handlers and server components don't import Clerk
 * directly. Multi-tenancy: every privileged query must be scoped to the
 * caller's orgId — see 01-ARCHITECTURE.md (multi-tenant model).
 */

/** The current Clerk userId, or null if signed out. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/** The active organization id for the current request, or null. */
export async function getOrgId(): Promise<string | null> {
  const { orgId } = await auth();
  return orgId ?? null;
}

/** Throw if not signed in; returns the userId. Use to guard server actions. */
export async function requireUser(): Promise<string> {
  const userId = await getUserId();
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}

export { currentUser };
