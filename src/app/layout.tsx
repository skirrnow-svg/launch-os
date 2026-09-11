import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

/**
 * Root layout. Loads the "Dark Studio" type system (all self-hosted): Space
 * Grotesk for display headings (next/font), Geist for body + Geist Mono for
 * labels/data (Vercel's `geist` package). Geist exposes --font-geist-sans /
 * --font-geist-mono; Space Grotesk exposes --font-display.
 * Clerk context lives in the authed layouts (dashboard, sign-in, sign-up).
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SkirrNow — AI ad agency for solopreneurs & agencies",
  description:
    "SkirrNow qualifies inbound leads, verifies the business, checks claims for legal risk, and produces sample ad copy and a concept video — with a one-click human approval gate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
