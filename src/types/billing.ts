/** What `GET .../billing` answers. Mirrors the NHC mobile route's `BillingStatus`. */
export type BillingStatus = {
  hasPremium: boolean;
  hasPro: boolean;
  /** Owners only may start or manage a subscription. */
  canSubscribe: boolean;
  /** A Stripe customer exists, so the portal has something to open. */
  hasBillingAccount: boolean;
  /** Optional so a server that predates it reads as "no caps" rather than crashing. */
  limits?: PlanLimits;
};

export type AiPlan = "premium" | "pro";

/** One plan's caps, a row of the web's `PLAN_LIMITS`. `null` means no cap. */
export type PlanLimits = {
  members: number | null;
  songs: number | null;
  /** Bytes of charts and audio. Capped on every plan. */
  storage: number;
};

/** Seats on a capped plan. A pending invite holds one, since accepting it adds a member. */
export type SeatUsage = {
  limit: number;
  members: number;
  pendingInvites: number;
  left: number;
};
