/**
 * Central legal constants for the public /legal/* pages.
 *
 * IMPORTANT — fill these before relying on the policies in a real dispute or
 * before submitting the pages to a payment gateway (Razorpay). The bracketed
 * values are deliberate placeholders: the operator chose "registered company"
 * but the exact registered identity was not yet supplied.
 */
export const LEGAL = {
  brand: "SkirrNow",
  shortBrand: "SkirrNow",
  // SkirrNow is a product operated by its registered parent company.
  entity: "DC AUTOMATION SYSTEMS (OPC) PRIVATE LIMITED",
  cin: "U72900GA2022OPC015390",
  gstin: "30AAJCD4251A1ZE",
  address: "C/o Jarson Colaco, 116A, Bansai, Curchorem, Goa 403706",
  governingCity: "Goa", // seat of courts for the jurisdiction clause
  governingLaw: "India",
  contactEmail: "support@skirrnow.com",
  grievanceEmail: "business@dcautomation.in",
  website: "https://skirrnow.com",
  updated: "10 October 2026",
} as const;

/** True when identity placeholders are still unfilled (drives the on-page banner). */
export const LEGAL_PLACEHOLDERS_PRESENT =
  LEGAL.entity.includes("[") || LEGAL.cin.includes("[") || LEGAL.address.includes("[");

export const LEGAL_PAGES = [
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "terms", label: "Terms of Use" },
  { slug: "refunds", label: "Refund & Cancellation" },
  { slug: "acceptable-use", label: "Acceptable Use & Disclaimer" },
] as const;
