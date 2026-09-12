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

/**
 * Platform admins — an email allowlist (ADMIN_EMAILS, comma-separated) plus the
 * owner + demo admin as built-in defaults so admin gating works even before the
 * env var is set. Admins reach the admin console; everyone else is a tenant.
 */
const DEFAULT_ADMIN_EMAILS = ["dextor@idocs.in", "admin+clerk_test@skirrnow.app"];
export function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...fromEnv]));
}
export function isPlatformAdmin(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}

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

/**
 * The current user together with their active organization.
 * - If a Clerk Organization is active, it is mapped to (or created as) a DB
 *   `organizations` row keyed by clerk_org_id.
 * - Otherwise a personal org (no clerk_org_id) is used/created, so users work
 *   before enabling Clerk Organizations.
 * TODO(phase-1+): sync org_members membership + roles from Clerk.
 */
export async function getContext() {
  const user = await getOrCreateUser();
  const { orgId, orgSlug } = await auth();

  if (orgId) {
    let org = await prisma.organizations.findUnique({ where: { clerk_org_id: orgId } });
    if (!org) {
      const base = orgSlug || `org-${orgId.slice(-8)}`;
      const name = orgSlug ? orgSlug.replace(/[-_]+/g, " ") : "Organization";
      org = await prisma.organizations.create({
        data: {
          clerk_org_id: orgId,
          name,
          slug: `${slugify(base)}-${orgId.slice(-6)}`,
          created_by: user.id,
        },
      });
    }
    return { user, org };
  }

  let org = await prisma.organizations.findFirst({
    where: { created_by: user.id, clerk_org_id: null, deleted_at: null },
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

/** Throw FORBIDDEN unless the current user is a platform admin. Returns context. */
export async function requireAdmin() {
  const ctx = await getContext();
  if (!isPlatformAdmin(ctx.user.email)) throw new Error("FORBIDDEN");
  return ctx;
}

export { currentUser };
