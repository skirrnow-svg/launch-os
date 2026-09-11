import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "SkirrNow — The autonomous AI ad agency",
  description:
    "SkirrNow qualifies inbound leads, verifies the business, checks claims for legal risk, and produces sample ad copy and a concept video — with a one-click human approval gate.",
};

/**
 * Root layout.
 * Wraps the whole app in Clerk's <ClerkProvider> so auth context is available
 * everywhere. Clerk reads NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY
 * from the environment (see .env.example).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
