import type { Config } from "tailwindcss";

/**
 * Launch OS platform Tailwind config.
 * Palette + type scale mirror docs/../New Instructions/08-LAUNCH_OS_BRAND_SYSTEM.md
 * (Slate neutrals + a single Blue accent; no gradients, corners <= 8px).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Accent (from brand system)
        accent: {
          DEFAULT: "#3B82F6", // Blue-500 — CTAs, links
          hover: "#2563EB", // Blue-600
        },
        success: "#10B981", // Green-500
        danger: "#EF4444", // Red-500
        warning: "#F59E0B", // Amber-500
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        // Brand rule: no rounded corners > 8px.
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
