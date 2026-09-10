/**
 * Shared TypeScript types for Launch OS.
 *
 * Phase 0: hand-written types that mirror the core domain in db/schema.sql.
 * TODO(phase-1): once the Prisma client is generated, prefer importing model
 * types from `@prisma/client` and keep only app-level / DTO types here.
 */

export type Plan = "free" | "starter" | "pro" | "enterprise";
export type OrgRole = "admin" | "member" | "viewer";
export type ProjectStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "completed"
  | "archived";
export type AssetType = "image" | "video" | "copy" | "script";
export type AssetStatus = "draft" | "generating" | "ready" | "failed";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  authId: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  createdAt: string;
}

/** Generic API envelope used by route handlers. */
export interface ApiResult<T> {
  data?: T;
  error?: string;
}
