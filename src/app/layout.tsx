import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout — intentionally minimal and STATIC (no ClerkProvider, no edge
 * runtime) so the public marketing pages (/, /get-started, 404) prerender to
 * static assets served straight off Cloudflare's CDN, instead of invoking the
 * Worker on every hit. Clerk context lives in the authed layouts (dashboard,
 * sign-in, sign-up) that actually need it — this keeps the edge Worker's
 * cold-start load down and avoids free-tier "Worker exceeded resource limits".
 */
export const metadata: Metadata = {
  title: "SkirrNow — The autonomous AI ad agency",
  description:
    "SkirrNow qualifies inbound leads, verifies the business, checks claims for legal risk, and produces sample ad copy and a concept video — with a one-click human approval gate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
