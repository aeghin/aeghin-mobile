/** What `GET .../billing` answers. Mirrors the NHC mobile route's `BillingStatus`. */
export type BillingStatus = {
  hasPremium: boolean;
  hasPro: boolean;
  /** Owners only may start or manage a subscription. */
  canSubscribe: boolean;
  /** A Stripe customer exists, so the portal has something to open. */
  hasBillingAccount: boolean;
};

export type AiPlan = "premium" | "pro";
