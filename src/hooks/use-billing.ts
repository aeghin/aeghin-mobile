import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useCallback } from "react";

import { useOrganizationDetails } from "@/hooks/use-organizations";
import { apiGet, apiPost } from "@/lib/api";
import { formatDayMonth } from "@/lib/events/format";
import type {
  AiPlan,
  BillingStatus,
  EmailAllowance,
  PlanUsage,
  SeatUsage,
} from "@/types/billing";

const billingPath = (orgId: string) => `/api/mobile/v1/organizations/${orgId}/billing`;

const billingKey = (userId: string | null | undefined, orgId: string) => [
  "organizations",
  userId,
  "billing",
  orgId,
];

/** Where Stripe's return page hands the browser back to. */
const RETURN_SCHEME = "aeghin://settings/billing";

/** The organization's AI plan, and whether the caller may change it. */
export function useBillingStatus(orgId: string) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: billingKey(userId, orgId),
    enabled: Boolean(userId && orgId),
    queryFn: () => apiGet<BillingStatus>(billingPath(orgId)),
    // Entitlements land through a webhook; a fresh read after checkout matters.
    staleTime: 0,
  });
}

/**
 * The organization's use of its plan, for the Plan screen. Owners and admins
 * only — the route answers 403 to a member, so `enabled` keeps it from firing.
 */
export function usePlanUsage(orgId: string, canManage: boolean) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["organizations", userId, "usage", orgId],
    enabled: Boolean(userId && orgId && canManage),
    queryFn: () => apiGet<PlanUsage>(`/api/mobile/v1/organizations/${orgId}/usage`),
    // Adding songs or files elsewhere in the app doesn't expire this, so each visit reads fresh.
    staleTime: 0,
  });
}

/**
 * The dashboard's `getSeatUsage`: members plus pending invites against the
 * plan's cap. Null when the plan has no cap or either read is still loading.
 * Display only — the server enforces.
 */
export function useSeatUsage(orgId: string): SeatUsage | null {
  const billing = useBillingStatus(orgId);
  const details = useOrganizationDetails(orgId);

  const limit = billing.data?.limits?.members ?? null;

  if (limit === null || !details.data) return null;

  const { memberCount, pendingInvitationCount } = details.data;

  return {
    limit,
    members: memberCount,
    pendingInvites: pendingInvitationCount,
    left: Math.max(0, limit - memberCount - pendingInvitationCount),
  };
}

/**
 * Whether the organization's plan includes Smart Scheduling. True until the
 * status lands, and from a server that predates the field, so nothing locks
 * that the server wouldn't refuse. Display only — the server enforces.
 */
export function useSmartSchedulingAvailable(orgId: string): boolean {
  const billing = useBillingStatus(orgId);

  return billing.data?.limits?.smartScheduling !== false;
}

/**
 * This month's group emails against the plan's allowance, for the two email
 * dialogs. Read only while one is open (`enabled`), and fresh each time, since
 * a send from the dashboard counts too. Null until it lands, or from a server
 * that predates it. Display only — the server enforces.
 */
export function useEmailAllowance(orgId: string, enabled: boolean): EmailAllowance | null {
  const usage = usePlanUsage(orgId, enabled);

  const bulkEmails = usage.data?.bulkEmails;

  if (!bulkEmails) return null;

  return {
    sent: bulkEmails.used,
    limit: bulkEmails.limit,
    resetsOn: usage.data?.resetsAt ? formatDayMonth(usage.data.resetsAt) : null,
  };
}

/**
 * Opens a Stripe page in an auth session and expires the status when it
 * closes. The session ends on its own when Stripe's return page navigates to
 * the app scheme, or when the person taps Done.
 */
export function useOpenStripe(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    async (url: string) => {
      await WebBrowser.openAuthSessionAsync(url, RETURN_SCHEME);
      await queryClient.invalidateQueries({ queryKey: billingKey(userId, orgId) });
    },
    [queryClient, userId, orgId],
  );
}

/** Starts Checkout for one plan and opens it. Owners only; the server says so otherwise. */
export function useStartCheckout(orgId: string) {
  const open = useOpenStripe(orgId);

  return useMutation({
    mutationFn: async (plan: AiPlan) => {
      const { url } = await apiPost<{ url: string }>(`${billingPath(orgId)}/checkout`, { plan });
      await open(url);
    },
  });
}

/** Opens the Customer Portal. */
export function useBillingPortal(orgId: string) {
  const open = useOpenStripe(orgId);

  return useMutation({
    mutationFn: async () => {
      const { url } = await apiPost<{ url: string }>(`${billingPath(orgId)}/portal`);
      await open(url);
    },
  });
}
