import type { Metadata, Viewport } from "next";
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
  title: "SkirrNow — AI web presence & customer messaging for small businesses",
  description:
    "SkirrNow builds a small business's web presence — landing page, social graphics and video — then helps it reach its own customers with review-request flows and WhatsApp messaging, all from one dashboard with human approval before anything ships.",
  manifest: "/site.webmanifest?v=2",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon-16x16.png?v=2", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png?v=2", type: "image/png", sizes: "32x32" },
      { url: "/android-chrome-192x192.png?v=2", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png?v=2", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico?v=2"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0E0D12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
