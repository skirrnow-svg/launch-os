import type { Config } from "tailwindcss";

/**
 * SkirrNow — "Editorial Press" design system.
 *
 * A premium, agency-grade look: Fraunces (serif display) + Libre Franklin
 * (body) + IBM Plex Mono (labels), on a warm paper ground with a plum-black ink
 * and a muted-forest accent. The neutral `slate` scale is remapped to a warm
 * greige and `white` to a warm near-white, so the existing utility classes
 * (bg-white, text-slate-900, border-slate-200 …) inherit the new palette
 * app-wide without touching every file.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm near-white for cards/surfaces (was pure #fff).
        white: "#FCFBF7",
        // Warm greige neutral, plum-tinted — replaces cool slate app-wide.
        slate: {
          50: "#F4F1EA", // paper / page ground
          100: "#EBE6DC",
          200: "#DED8CB", // hairline borders
          300: "#CAC2B1",
          400: "#A79E8C", // muted / placeholder
          500: "#837A69", // secondary text
          600: "#5E5647", // body text
          700: "#443E33",
          800: "#2B2620",
          900: "#1E1922", // ink / headings
        },
        // Muted forest accent — CTAs, links.
        accent: {
          DEFAULT: "#3A5648",
          hover: "#2C4437",
        },
        // Legacy indigo/blue utilities are remapped onto the forest accent so
        // existing `indigo-*` / `blue-50` classes inherit the palette app-wide.
        indigo: {
          50: "#E9EFEB",
          100: "#DCE6DF",
          200: "#C6D3CB",
          300: "#A9BCB0",
          400: "#5E7A6B",
          500: "#496856",
          600: "#3A5648",
          700: "#2C4437",
        },
        blue: { 50: "#E7EDE8" },
        success: "#3A7D5B",
        danger: "#B23A2E",
        warning: "#B5771F",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-franklin)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        // Editorial restraint: crisp corners.
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
