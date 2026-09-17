/**
 * Central legal constants for the public /legal/* pages.
 *
 * IMPORTANT — fill these before relying on the policies in a real dispute or
 * before submitting the pages to a payment gateway (Razorpay). The bracketed
 * values are deliberate placeholders: the operator chose "registered company"
 * but the exact registered identity was not yet supplied.
 */
export const LEGAL = {
  brand: "SkirrNow Launch OS",
  shortBrand: "SkirrNow",
  entity: "[Company Legal Name Pvt. Ltd.]", // registered legal name — fill in
  cin: "[CIN / Company Registration No.]", // fill in
  address: "[Registered Office Address, City, State, PIN]", // fill in
  governingCity: "[City]", // seat of courts for jurisdiction clause — fill in
  governingLaw: "India",
  contactEmail: "dextor@skirrnow.com",
  website: "https://skirrnow.com",
  updated: "14 September 2026",
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
