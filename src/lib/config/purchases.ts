/**
 * Apple's Guideline 3.1.1 wants an in-app purchase for anything that unlocks a
 * feature inside the app, so this build sells nothing: no prices, no checkout,
 * no link out to Stripe. Plans bought on the web still unlock everything here —
 * only the buying is hidden.
 *
 * Flip to `true` once StoreKit ships; every surface below reads this.
 */
// Typed `boolean` on purpose: a literal `false` would make every guarded
// branch below look dead to the checker and the linter.
export const MOBILE_PURCHASES_ENABLED: boolean = false;
