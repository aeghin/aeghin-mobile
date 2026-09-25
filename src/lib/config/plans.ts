import type { BillingStatus, OrgPlan } from "@/types/billing";

export const PLAN_NAMES: Record<OrgPlan, string> = {
  free: "Free",
  starter: "Starter",
  premium: "Premium",
  pro: "Pro",
};

/**
 * The organization's plan from its billing status. A server that predates
 * `plan` only sends the two AI flags, and those can't tell Starter from Free.
 */
export function planOf(status?: BillingStatus): OrgPlan {
  if (status?.plan) return status.plan;

  return status?.hasPro ? "pro" : status?.hasPremium ? "premium" : "free";
}
