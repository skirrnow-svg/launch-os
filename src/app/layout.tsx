import type { Metadata } from "next";
import { Fraunces, Libre_Franklin, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * Root layout. Loads the Editorial Press type system (self-hosted via next/font,
 * so there's no layout shift and no runtime request to Google): Fraunces for
 * display, Libre Franklin for body, IBM Plex Mono for labels/data. Clerk context
 * lives in the authed layouts (dashboard, sign-in, sign-up) that need it.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-fraunces",
  display: "swap",
});
const franklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-franklin",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SkirrNow — AI ad agency for solopreneurs & agencies",
  description:
    "SkirrNow qualifies inbound leads, verifies the business, checks claims for legal risk, and produces sample ad copy and a concept video — with a one-click human approval gate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${franklin.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
