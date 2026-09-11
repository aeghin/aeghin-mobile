/**
 * The public pages this app links out to.
 *
 * Deliberately *not* derived from `EXPO_PUBLIC_WEB_APP_URL`, which names
 * whichever deployment this build talks to — a LAN address in development.
 * These are the published documents: the App Store listing points at the same
 * privacy policy, and a reviewer opening it from inside a build must reach the
 * real one rather than a laptop that stopped serving weeks ago.
 */
const PUBLIC_SITE = "https://aeghin.com";

export const legalLinks = {
  privacy: `${PUBLIC_SITE}/privacy`,
  terms: `${PUBLIC_SITE}/terms`,
  support: `${PUBLIC_SITE}/support`,
} as const;
