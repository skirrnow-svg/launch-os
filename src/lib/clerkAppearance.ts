import type { Appearance } from "@clerk/types";

/**
 * Dark Studio appearance for every Clerk surface (SignIn, SignUp, UserButton,
 * OrganizationSwitcher). Uses `variables` only — no @clerk/themes dependency —
 * mapped to the same tokens as the rest of the app (canvas #0E0D12, raised
 * surface #17161D, off-white text, electric-lime primary with dark on-primary
 * text, 6px radii).
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#BEF264",
    colorTextOnPrimaryBackground: "#17161D",
    colorBackground: "#17161D",
    colorText: "#ECEAF1",
    colorTextSecondary: "#A7A3B3",
    colorInputBackground: "#0E0D12",
    colorInputText: "#ECEAF1",
    colorNeutral: "#ECEAF1",
    colorDanger: "#F87171",
    colorSuccess: "#4ADE80",
    colorWarning: "#FBBF24",
    borderRadius: "6px",
  },
  elements: {
    card: { boxShadow: "none", border: "1px solid #26242F" },
    socialButtonsBlockButton: { border: "1px solid #26242F" },
  },
};
