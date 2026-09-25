/** Mirrors the NHC's `OrgPlan`. */
export type OrgPlan = "free" | "starter" | "premium" | "pro";

/** The plans an organization can pay for. */
export type PaidPlan = "starter" | "premium" | "pro";

/** What `GET .../billing` answers. Mirrors the NHC mobile route's `BillingStatus`. */
export type BillingStatus = {
  /** Optional so a server that predates it falls back to the two AI flags. */
  plan?: OrgPlan;
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
  /** Service types in use. Optional so a server that predates it reads as no cap. */
  serviceTypes?: number | null;
  /** Bytes of charts and audio. Capped on every plan. */
  storage: number;
  /**
   * Message All and Email Team sends a calendar month. This and the two below
   * are optional so a server that predates them reads as before.
   */
  bulkEmails?: number;
  /** Messages to the AI a calendar month. 0 on Free, which has no AI. */
  aiRuns?: number;
  /** Auto-filling declines. Off on Free. */
  smartScheduling?: boolean;
};

/**
 * What `GET .../usage` answers: the organization's use of its plan. Mirrors
 * `PlanUsage` in the NHC's `lib/billing/limits.ts`. Owners and admins only.
 */
export type PlanUsage = {
  plan: OrgPlan;
  members: { used: number; pending: number; limit: number | null };
  songs: { used: number; limit: number | null };
  /** Optional, like the other fields an older server doesn't send. */
  serviceTypes?: { used: number; limit: number | null };
  /** Bytes. */
  storage: { used: number; limit: number };
  /** Group emails this calendar month. Optional, like the monthly fields on `PlanLimits`. */
  bulkEmails?: { used: number; limit: number };
  /** AI messages this calendar month. A limit of 0 means the plan has no AI. */
  aiRuns?: { used: number; limit: number };
  /** When the monthly counts start over: midnight UTC on the 1st, as ISO. */
  resetsAt?: string;
};

/** This month's Message All and Email Team sends against the plan's allowance. */
export type EmailAllowance = {
  sent: number;
  limit: number;
  /** "Oct 1", or null from a server that doesn't say. */
  resetsOn: string | null;
};

/** Seats on a capped plan. A pending invite holds one, since accepting it adds a member. */
export type SeatUsage = {
  plan: OrgPlan;
  limit: number;
  members: number;
  pendingInvites: number;
  left: number;
};
