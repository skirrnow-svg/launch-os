import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";

/**
 * Auth helpers (Clerk + DB identity sync).
 *
 * Identity mapping (MVP "personal org" model):
 * - The Clerk userId is stored in `users.auth_id` (auth_provider = 'clerk').
 * - Each user gets ONE personal organization (the org they created); it is
 *   created on first access. Projects and org-scoped data hang off that org.
 * TODO(phase-1+): replace the personal-org model with Clerk Organizations +
 * `org_members` membership/roles.
 */

/** The current Clerk userId, or null if signed out. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/** Throw if not signed in; returns the Clerk userId. */
export async function requireUser(): Promise<string> {
  const userId = await getUserId();
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

/** Resolve (or create + update) the DB `users` row for the current Clerk user. */
export async function getOrCreateUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("UNAUTHENTICATED");
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${clerkUser.id}@users.noemail.local`;
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    email;
  return prisma.users.upsert({
    where: { auth_id: clerkUser.id },
    update: { email, name, avatar_url: clerkUser.imageUrl ?? undefined },
    create: {
      auth_id: clerkUser.id,
      email,
      name,
      avatar_url: clerkUser.imageUrl ?? undefined,
      auth_provider: "clerk",
      email_verified: true,
    },
  });
}

/** The current user together with their personal organization (created if missing). */
export async function getContext() {
  const user = await getOrCreateUser();
  let org = await prisma.organizations.findFirst({
    where: { created_by: user.id, deleted_at: null },
    orderBy: { created_at: "asc" },
  });
  if (!org) {
    const base = user.name || user.email.split("@")[0] || "workspace";
    const slug = `${slugify(base)}-${user.id.slice(0, 6)}`;
    org = await prisma.organizations.create({
      data: { name: `${base}'s Workspace`, slug, created_by: user.id },
    });
  }
  return { user, org };
}

/** The current user's personal organization (created if missing). */
export async function getCurrentOrg() {
  return (await getContext()).org;
}

export { currentUser };
