import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Clerk auth middleware (Phase 0 stub).
 *
 * Public routes are accessible without authentication. Every other route is
 * protected: unauthenticated requests are redirected to sign-in by Clerk.
 *
 * TODO(phase-1): add org-scoped authorization (RBAC) and per-route policies
 * once the sign-in / sign-up flows and org resolution exist.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = auth();
    if (!userId) return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
