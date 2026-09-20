import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk auth middleware.
 *
 * Public routes are accessible without authentication. Every other route is
 * protected: an unauthenticated request is redirected to the app's OWN
 * /sign-in page (same origin), not Clerk's hosted Account Portal. Keeping the
 * sign-in flow on-origin is what makes the development Clerk instance hand the
 * session back correctly on a deployed domain — a cross-origin bounce to
 * accounts.dev leaves the dev-browser token behind and "nothing happens"
 * after authenticating.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/legal(.*)",
  "/contact(.*)",
  "/get-started(.*)",
  "/free(.*)",
  "/brand-studio(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/public(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId } = auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|wasm|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
