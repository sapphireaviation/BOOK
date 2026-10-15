/**
 * Brand and site settings. Everything brand specific comes from here so the
 * product can be renamed by changing env vars only.
 */
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Sapphire",
  shortName: process.env.NEXT_PUBLIC_SITE_SHORT_NAME ?? process.env.NEXT_PUBLIC_SITE_NAME ?? "Sapphire",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  tagline: "Flights and stays with no platform fee",
  description:
    "Book flights at the airline's own fare and stays at the owner's own price. No platform fee for travelers or hosts.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Sapphire Travel",
  country: process.env.NEXT_PUBLIC_COUNTRY ?? "IN",
  defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "INR",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en-IN",
  social: {
    x: process.env.NEXT_PUBLIC_SOCIAL_X,
    instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM,
  },
} as const;

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
