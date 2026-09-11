import type { Config } from "tailwindcss";

/**
 * SkirrNow — "Dark Studio" design system.
 *
 * Dark-first: a near-black canvas, off-white text, a single electric-lime accent
 * used sparingly. The neutral `slate` scale is INVERTED (slate-50 = darkest
 * canvas … slate-900 = off-white) and `white` is remapped to a raised dark
 * surface — so existing utilities flip to dark without touching every file:
 *   • bg-slate-50  → page canvas          • bg-white     → raised card surface
 *   • text-slate-900 → off-white heading  • text-white   → dark text (reads on lime)
 *   • border-slate-200 → subtle dark rule • bg-accent    → electric lime
 * Legacy indigo/blue utilities map onto the accent too.
 * Source of truth: design/tokens/*.md.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Raised dark surface — also becomes button text on the light accent.
        white: "#17161D",
        // Inverted neutral scale (dark → light).
        slate: {
          50: "#0E0D12", // canvas / page ground
          100: "#16151C", // subtle raised
          200: "#26242F", // hairline borders
          300: "#35323F",
          400: "#6E6A7A", // muted / placeholder
          500: "#8B8798", // secondary text
          600: "#A7A3B3", // body text
          700: "#C4C1CE",
          800: "#DAD8E1",
          900: "#ECEAF1", // primary text / headings
        },
        // Electric lime accent — CTAs, links, highlights (use sparingly).
        accent: {
          DEFAULT: "#BEF264",
          hover: "#A8E63C",
        },
        // Legacy indigo/blue remapped onto the accent.
        indigo: {
          50: "#1C1B24",
          100: "#232230",
          200: "#2F2E3C",
          300: "#3A3948",
          400: "#9BC24E",
          500: "#AEDE55",
          600: "#BEF264",
          700: "#A8E63C",
        },
        blue: { 50: "#1C1B24" },
        success: "#4ADE80",
        danger: "#F87171",
        warning: "#FBBF24",
      },
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
