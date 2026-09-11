import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "Launch OS",
  description:
    "Multi-tenant SaaS for AI-native launch orchestration — generate assets, orchestrate campaigns, track results.",
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
